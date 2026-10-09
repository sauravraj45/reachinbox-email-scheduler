import { withTransaction } from '../db/pool';
import { enqueueEmails } from '../queue/queue';
import { linkAttachments } from './attachments.service';
import type { EmailRow } from './emails.repo';
import { indexEmails } from './search.service';

export interface ScheduleInput {
  userId: string;
  senderId: number;
  subject: string;
  body: string;
  leads: string[];
  startAt: Date;
  delayMs: number;
  hourlyLimit: number;
  /** Draft uploads (POST /api/attachments) to attach to every email of the campaign. */
  attachmentIds?: string[];
}

export interface ScheduleResult {
  campaignId: string;
  scheduled: number;
  duplicatesRemoved: number;
  firstAt: Date;
  lastAt: Date;
}

const INSERT_CHUNK = 500;

/**
 * Persist a campaign and its emails (one row per lead), then create one delayed
 * BullMQ job per email. Email i is scheduled at startAt + i * delayMs.
 *
 * Order matters: rows are committed BEFORE jobs are enqueued. If enqueueing fails
 * halfway (e.g. Redis blip), the rows are still 'scheduled' in the DB and the
 * worker's startup reconciliation recreates the missing jobs.
 */
export async function scheduleCampaign(input: ScheduleInput): Promise<ScheduleResult> {
  const leads = [...new Set(input.leads.map((l) => l.trim().toLowerCase()).filter(Boolean))];
  const duplicatesRemoved = input.leads.length - leads.length;
  const start = input.startAt.getTime();

  const { campaignId, rows } = await withTransaction(async (client) => {
    const c = await client.query<{ id: string }>(
      `INSERT INTO campaigns (user_id, sender_id, subject, body, start_at, delay_ms, hourly_limit, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [input.userId, input.senderId, input.subject, input.body, input.startAt, input.delayMs, input.hourlyLimit, leads.length],
    );
    const campaignId = c.rows[0].id;
    await linkAttachments(client, input.userId, campaignId, input.attachmentIds ?? []);
    const rows: EmailRow[] = [];

    for (let off = 0; off < leads.length; off += INSERT_CHUNK) {
      const chunk = leads.slice(off, off + INSERT_CHUNK);
      // Per-row params (seq, to, scheduled_at) first, then the shared ones once at the end.
      const values: unknown[] = chunk.flatMap((to, i) => {
        const seq = off + i;
        return [seq, to, new Date(start + seq * input.delayMs)];
      });
      const base = values.length;
      values.push(campaignId, input.userId, input.senderId, input.subject, input.body);
      const placeholders = chunk
        .map((_, i) => {
          const b = i * 3;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${b + 1}, $${b + 2}, $${base + 4}, $${base + 5}, $${b + 3})`;
        })
        .join(',');
      const res = await client.query<EmailRow>(
        `INSERT INTO emails (campaign_id, user_id, sender_id, seq, to_email, subject, body, scheduled_at)
         VALUES ${placeholders} RETURNING *`,
        values,
      );
      rows.push(...res.rows);
    }
    return { campaignId, rows };
  });

  await enqueueEmails(rows.map((r) => ({ id: r.id, scheduledAt: new Date(r.scheduled_at) })));
  void indexEmails(rows);

  return {
    campaignId,
    scheduled: rows.length,
    duplicatesRemoved,
    firstAt: new Date(start),
    lastAt: new Date(start + Math.max(0, leads.length - 1) * input.delayMs),
  };
}
