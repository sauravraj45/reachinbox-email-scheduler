import express, { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { requireAuth } from '../auth/auth';
import * as attachments from '../services/attachments.service';
import * as repo from '../services/emails.repo';
import { scheduleCampaign } from '../services/scheduler.service';
import { removeEmailFromIndex, searchEmails } from '../services/search.service';
import { emailQueue, jobIdFor } from '../queue/queue';
import { getSender, listSenders } from '../services/senders.service';
import { disconnectSlack, getSlackConnection, notifySlack, slackConfigured } from '../services/slack.service';

const router = Router();
router.use(requireAuth);

type Handler = (req: Request, res: Response) => Promise<unknown>;
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

const MAX_LEADS = 10_000;

const campaignSchema = z.object({
  senderId: z.coerce.number().int().positive().optional(),
  subject: z.string().trim().min(1).max(500),
  body: z.string().min(1).max(100_000),
  leads: z.array(z.string().trim().toLowerCase().pipe(z.email())).min(1).max(MAX_LEADS),
  startAt: z.coerce.date().optional(),
  delayMs: z.coerce.number().int().min(0).max(24 * 3600 * 1000).default(config.MIN_DELAY_BETWEEN_SENDS_MS),
  hourlyLimit: z.coerce.number().int().positive().default(config.DEFAULT_CAMPAIGN_HOURLY_LIMIT),
  attachmentIds: z.array(z.uuid()).max(attachments.MAX_ATTACHMENTS).default([]),
});

/** Single email (handy for Postman). */
const singleSchema = z.object({
  to: z.string().trim().toLowerCase().pipe(z.email()),
  subject: z.string().trim().min(1).max(500),
  body: z.string().min(1).max(100_000),
  scheduledAt: z.coerce.date().optional(),
  senderId: z.coerce.number().int().positive().optional(),
});

async function resolveSenderId(senderId?: number): Promise<number> {
  if (senderId) {
    if (!(await getSender(senderId))) throw Object.assign(new Error('Unknown sender'), { status: 400 });
    return senderId;
  }
  const [first] = await listSenders();
  if (!first) throw Object.assign(new Error('No senders configured'), { status: 500 });
  return first.id;
}

router.get('/me', h(async (req, res) => {
  const slack = await getSlackConnection(req.user!.id);
  const u = req.user!;
  res.json({
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatar_url,
    slack: { configured: slackConfigured(), connected: Boolean(slack), teamName: slack?.team_name ?? null, channel: slack?.channel ?? null },
  });
}));

router.get('/config', (_req, res) => {
  res.json({
    minDelayBetweenSendsMs: config.MIN_DELAY_BETWEEN_SENDS_MS,
    maxEmailsPerHourPerSender: config.MAX_EMAILS_PER_HOUR_PER_SENDER,
    defaultHourlyLimit: config.DEFAULT_CAMPAIGN_HOURLY_LIMIT,
    workerConcurrency: config.WORKER_CONCURRENCY,
    maxLeads: MAX_LEADS,
  });
});

router.get('/senders', h(async (_req, res) => res.json(await listSenders())));

router.post('/campaigns', h(async (req, res) => {
  const input = campaignSchema.parse(req.body);
  const result = await scheduleCampaign({
    userId: req.user!.id,
    senderId: await resolveSenderId(input.senderId),
    subject: input.subject,
    body: input.body,
    leads: input.leads,
    startAt: input.startAt ?? new Date(),
    delayMs: input.delayMs,
    hourlyLimit: Math.min(input.hourlyLimit, config.MAX_EMAILS_PER_HOUR_PER_SENDER),
    attachmentIds: input.attachmentIds,
  });
  res.status(201).json(result);
}));

router.post('/emails', h(async (req, res) => {
  const input = singleSchema.parse(req.body);
  const result = await scheduleCampaign({
    userId: req.user!.id,
    senderId: await resolveSenderId(input.senderId),
    subject: input.subject,
    body: input.body,
    leads: [input.to],
    startAt: input.scheduledAt ?? new Date(),
    delayMs: 0,
    hourlyLimit: config.DEFAULT_CAMPAIGN_HOURLY_LIMIT,
  });
  res.status(201).json(result);
}));

const listQuery = z.object({
  tab: z.enum(['scheduled', 'sent']).default('scheduled'),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  /** Optional narrowing within the tab (the list's filter menu). */
  status: z.enum(['scheduled', 'rate_limited', 'sending', 'sent', 'failed']).optional(),
});

const toDto = (e: repo.EmailWithMeta) => ({
  id: e.id,
  campaignId: e.campaign_id,
  to: e.to_email,
  subject: e.subject,
  body: e.body,
  status: e.status,
  scheduledAt: e.scheduled_at,
  sentAt: e.sent_at,
  error: e.error,
  previewUrl: e.preview_url,
  attempts: e.attempts,
  rescheduleCount: e.reschedule_count,
  sender: { id: e.sender_id, name: e.sender_name, email: e.sender_email },
});

router.get('/emails', h(async (req, res) => {
  const { tab, q, page, pageSize, status } = listQuery.parse(req.query);
  const tabStatuses = tab === 'scheduled' ? repo.PENDING_STATUSES : repo.DONE_STATUSES;
  const statuses = status ? tabStatuses.filter((s) => s === status) : tabStatuses;
  if (statuses.length === 0) return res.json({ items: [], total: 0, page, pageSize, searchEngine: null });
  const offset = (page - 1) * pageSize;
  const userId = req.user!.id;

  if (q) {
    // Full-text search via Elasticsearch; fall back to SQL ILIKE if ES is unavailable.
    try {
      const { ids, total } = await searchEmails({ userId, q, statuses, from: offset, size: pageSize });
      const items = await repo.getEmailsByIds(userId, ids);
      return res.json({ items: items.map(toDto), total, page, pageSize, searchEngine: 'elasticsearch' });
    } catch (err) {
      console.warn('[api] ES search failed, falling back to SQL:', (err as Error).message);
    }
  }
  const { items, total } = await repo.listEmails({ userId, statuses, limit: pageSize, offset, q });
  res.json({ items: items.map(toDto), total, page, pageSize, searchEngine: q ? 'sql' : null });
}));

router.get('/emails/stats', h(async (req, res) => {
  const c = await repo.countByStatus(req.user!.id);
  res.json({ scheduled: c.scheduled + c.rate_limited + c.sending, sent: c.sent, failed: c.failed, byStatus: c });
}));

/** Cancel a scheduled email or remove a sent one from history. */
router.delete('/emails/:id', h(async (req, res) => {
  const id = String(req.params.id);
  const result = await repo.deleteEmail(req.user!.id, id);
  if (result === 'not_found') return res.status(404).json({ error: 'Not found' });
  if (result === 'sending') return res.status(409).json({ error: 'This email is being sent right now; try again in a moment.' });
  // Best-effort: drop the delayed job so it doesn't linger (an active job just no-ops).
  await emailQueue.getJob(jobIdFor(id)).then((job) => job?.remove()).catch(() => undefined);
  void removeEmailFromIndex(id);
  res.json({ ok: true });
}));

router.get('/emails/:id', h(async (req, res) => {
  const [email] = await repo.getEmailsByIds(req.user!.id, [String(req.params.id)]);
  if (!email) return res.status(404).json({ error: 'Not found' });
  const files = await attachments.listCampaignAttachmentMeta(email.campaign_id);
  res.json({ ...toDto(email), attachments: files.map(attachments.toAttachmentDto) });
}));

/**
 * Upload one attachment as the raw request body (Content-Type: application/octet-stream).
 * Real name/type come in X-Filename / X-Content-Type headers. Returns a draft id that is
 * passed as attachmentIds when scheduling.
 */
router.post(
  '/attachments',
  express.raw({ type: 'application/octet-stream', limit: attachments.MAX_ATTACHMENT_BYTES }),
  h(async (req, res) => {
    const data = req.body as Buffer;
    if (!Buffer.isBuffer(data) || data.length === 0) return res.status(400).json({ error: 'Empty file' });
    const filename = decodeURIComponent(String(req.header('x-filename') ?? 'attachment')).replace(/[\\/\r\n]/g, '_').slice(0, 200);
    const contentType = String(req.header('x-content-type') || 'application/octet-stream').slice(0, 100);
    const meta = await attachments.createAttachment({ userId: req.user!.id, filename, contentType, data });
    res.status(201).json(attachments.toAttachmentDto(meta));
  }),
);

router.get('/attachments/:id', h(async (req, res) => {
  const file = await attachments.getAttachmentForUser(req.user!.id, String(req.params.id));
  if (!file) return res.status(404).json({ error: 'Not found' });
  // Only raster images render inline (thumbnails); everything else, incl. SVG/HTML, downloads.
  const inline = /^image\/(png|jpe?g|gif|webp)$/.test(file.content_type) && req.query.download === undefined;
  res.setHeader('Content-Type', inline ? file.content_type : 'application/octet-stream');
  res.setHeader('Content-Length', file.size);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
  res.end(file.data);
}));

router.delete('/attachments/:id', h(async (req, res) => {
  const ok = await attachments.deleteDraftAttachment(req.user!.id, String(req.params.id));
  res.status(ok ? 200 : 404).json({ ok });
}));

router.delete('/slack', h(async (req, res) => {
  await disconnectSlack(req.user!.id);
  res.json({ ok: true });
}));

router.post('/slack/test', h(async (req, res) => {
  const ok = await notifySlack(req.user!.id, `:wave: Test notification from ReachInbox Scheduler for ${req.user!.email}`);
  if (!ok) return res.status(400).json({ error: 'Slack is not connected or the message failed' });
  res.json({ ok: true });
}));

export default router;
