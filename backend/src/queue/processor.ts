import { DelayedError, Job } from 'bullmq';
import { config } from '../config';
import * as repo from '../services/emails.repo';
import { indexEmail } from '../services/search.service';
import { getCampaignAttachmentFiles } from '../services/attachments.service';
import { getSender } from '../services/senders.service';
import { sendMail } from '../services/mailer';
import { getSlackConnection, notifySlack } from '../services/slack.service';
import type { EmailJobData } from './queue';
import { nextWindowSlot, reserveHourlySlot, reserveSendGap, shouldNotify, windowStart, LimitScope } from './rateLimiter';

export const LOCK_DURATION_MS = 60_000;
const STALE_SENDING_MS = 2 * LOCK_DURATION_MS;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function processEmailJob(job: Job<EmailJobData>, token?: string): Promise<{ status: string }> {
  const { emailId } = job.data;

  // 1. Idempotency: claim the row. Already sent/failed -> no-op.
  const claim = await repo.claimForSending(emailId, STALE_SENDING_MS);
  if (claim.state === 'done') return { status: 'skipped' };
  if (claim.state === 'busy') throw new Error('Email is being processed by another worker; will retry');
  const email = claim.email;

  // 2. Hourly rate limits (Redis counters, atomic across all workers).
  const senderLimit = config.MAX_EMAILS_PER_HOUR_PER_SENDER;
  const campaignLimit = Math.min(email.hourly_limit, senderLimit);
  const gap = config.MIN_DELAY_BETWEEN_SENDS_MS;
  const r = await reserveHourlySlot({ senderId: email.sender_id, campaignId: email.campaign_id, senderLimit, campaignLimit });

  if (!r.ok) {
    // Limit hit: never drop/fail. Push the job into the next hour window, keeping order.
    const scopeKey = r.scope === 'sender' ? `sender:${email.sender_id}` : `campaign:${email.campaign_id}`;
    const at = await nextWindowSlot(scopeKey, r.window, gap);
    const row = await repo.markRateLimited(emailId, new Date(at));
    void indexEmail(row);
    await alertLimitReached(email, r.scope!, r.window, r.scope === 'sender' ? senderLimit : campaignLimit);
    await job.moveToDelayed(at, token);
    throw new DelayedError();
  }
  if (r.scope) {
    // This send just used the last slot of the window -> alert the moment the limit is reached.
    void alertLimitReached(email, r.scope, r.window, r.scope === 'sender' ? senderLimit : campaignLimit);
  }

  // 3. Minimum gap between two sends of the same sender (provider throttling).
  const wait = await reserveSendGap(email.sender_id, gap);
  if (wait > 0) await sleep(wait);

  // 4. Send.
  const sender = await getSender(email.sender_id);
  if (!sender) {
    void indexEmail(await repo.markFailed(emailId, `Sender ${email.sender_id} not found`));
    return { status: 'failed' };
  }
  try {
    const files = await getCampaignAttachmentFiles(email.campaign_id);
    const { messageId, previewUrl } = await sendMail(sender, {
      emailId,
      to: email.to_email,
      subject: email.subject,
      body: email.body,
      attachments: files.map((f) => ({ filename: f.filename, content: f.data, contentType: f.content_type })),
    });
    const row = await repo.markSent(emailId, messageId, previewUrl);
    void indexEmail(row);
    console.log(`[worker] sent ${emailId} -> ${email.to_email} via ${sender.email}`);
    return { status: 'sent' };
  } catch (err) {
    const message = (err as Error).message;
    const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    if (isLastAttempt) {
      void indexEmail(await repo.markFailed(emailId, message));
    } else {
      await repo.markRetrying(emailId, message);
    }
    console.warn(`[worker] send failed for ${emailId} (attempt ${job.attemptsMade + 1}): ${message}`);
    throw err;
  }
}

async function alertLimitReached(email: repo.EmailWithMeta, scope: LimitScope, window: number, limit: number) {
  const scopeId = scope === 'sender' ? `sender:${email.sender_id}` : `campaign:${email.campaign_id}`;
  // Not connected: silently skip, and don't burn the once-per-window flag, so connecting
  // Slack mid-hour starts alerts immediately.
  if (!(await getSlackConnection(email.user_id))) return;
  if (!(await shouldNotify(`${scopeId}:${window}:${email.user_id}`))) return;

  const resumesAt = new Date(windowStart(window + 1)).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const who = scope === 'sender'
    ? `Sender *${email.sender_name}* (${email.sender_email})`
    : `Campaign *"${email.subject}"* (sender ${email.sender_email})`;
  const text = `:rotating_light: Hourly limit reached — ${who} hit ${limit} emails/hour. Remaining emails are queued and resume at ${resumesAt}.`;
  const sent = await notifySlack(email.user_id, text);
  console.log(`[ratelimit] ${scopeId} reached ${limit}/h in window ${window}; slack notified=${sent}`);
}
