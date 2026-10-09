import { pool } from '../db/pool';

export type EmailStatus = 'scheduled' | 'rate_limited' | 'sending' | 'sent' | 'failed';

export const PENDING_STATUSES: EmailStatus[] = ['scheduled', 'rate_limited', 'sending'];
export const DONE_STATUSES: EmailStatus[] = ['sent', 'failed'];

export interface EmailRow {
  id: string;
  campaign_id: string;
  user_id: string;
  sender_id: number;
  seq: number;
  to_email: string;
  subject: string;
  body: string;
  scheduled_at: Date;
  status: EmailStatus;
  sent_at: Date | null;
  error: string | null;
  message_id: string | null;
  preview_url: string | null;
  attempts: number;
  reschedule_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface EmailWithMeta extends EmailRow {
  sender_email: string;
  sender_name: string;
  hourly_limit: number;
}

const SELECT_WITH_META = `
  SELECT e.*, s.email AS sender_email, s.name AS sender_name, c.hourly_limit
  FROM emails e
  JOIN senders s ON s.id = e.sender_id
  JOIN campaigns c ON c.id = e.campaign_id`;

async function getEmail(id: string): Promise<EmailWithMeta | null> {
  const { rows } = await pool.query<EmailWithMeta>(`${SELECT_WITH_META} WHERE e.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getEmailsByIds(userId: string, ids: string[]): Promise<EmailWithMeta[]> {
  if (ids.length === 0) return [];
  const { rows } = await pool.query<EmailWithMeta>(
    `${SELECT_WITH_META} WHERE e.user_id = $1 AND e.id = ANY($2::uuid[])`,
    [userId, ids],
  );
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

export async function listEmails(params: {
  userId: string;
  statuses: EmailStatus[];
  limit: number;
  offset: number;
  q?: string;
}): Promise<{ items: EmailWithMeta[]; total: number }> {
  const pending = params.statuses.some((s) => PENDING_STATUSES.includes(s));
  // Scheduled: soonest first. Sent: most recent first.
  const order = pending ? 'e.scheduled_at ASC, e.seq ASC' : 'e.sent_at DESC NULLS LAST, e.updated_at DESC';
  const args: unknown[] = [params.userId, params.statuses];
  let where = 'e.user_id = $1 AND e.status = ANY($2::text[])';
  if (params.q) {
    args.push(`%${params.q}%`);
    where += ` AND (e.to_email ILIKE $3 OR e.subject ILIKE $3 OR e.body ILIKE $3)`;
  }
  const [items, count] = await Promise.all([
    pool.query<EmailWithMeta>(
      `${SELECT_WITH_META} WHERE ${where} ORDER BY ${order} LIMIT ${params.limit} OFFSET ${params.offset}`,
      args,
    ),
    pool.query<{ count: string }>(`SELECT count(*) FROM emails e WHERE ${where}`, args),
  ]);
  return { items: items.rows, total: Number(count.rows[0].count) };
}

export async function countByStatus(userId: string): Promise<Record<EmailStatus, number>> {
  const { rows } = await pool.query<{ status: EmailStatus; count: string }>(
    'SELECT status, count(*) FROM emails WHERE user_id = $1 GROUP BY status',
    [userId],
  );
  const out: Record<EmailStatus, number> = { scheduled: 0, rate_limited: 0, sending: 0, sent: 0, failed: 0 };
  for (const r of rows) out[r.status] = Number(r.count);
  return out;
}

export type ClaimResult =
  | { state: 'claimed'; email: EmailWithMeta }
  | { state: 'done' } // already sent/failed (or deleted): duplicate/replayed job -> no-op
  | { state: 'busy' }; // another worker holds it right now

/**
 * Atomically claim an email for sending (idempotency guard).
 * A row stuck in 'sending' is only re-claimable once it is stale (its worker
 * crashed mid-flight), so two workers can never send the same email concurrently.
 */
export async function claimForSending(id: string, staleAfterMs: number): Promise<ClaimResult> {
  const { rowCount } = await pool.query(
    `UPDATE emails SET status = 'sending', attempts = attempts + 1, updated_at = now()
     WHERE id = $1 AND (status IN ('scheduled','rate_limited')
       OR (status = 'sending' AND updated_at < now() - ($2::int * interval '1 millisecond')))`,
    [id, staleAfterMs],
  );
  if (rowCount) {
    const email = await getEmail(id);
    return email ? { state: 'claimed', email } : { state: 'done' };
  }
  const { rows } = await pool.query<{ status: EmailStatus }>('SELECT status FROM emails WHERE id = $1', [id]);
  return rows[0]?.status === 'sending' ? { state: 'busy' } : { state: 'done' };
}

export async function markSent(id: string, messageId: string, previewUrl: string | null): Promise<EmailRow> {
  const { rows } = await pool.query<EmailRow>(
    `UPDATE emails SET status = 'sent', sent_at = now(), message_id = $2, preview_url = $3,
       error = NULL, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, messageId, previewUrl],
  );
  return rows[0];
}

export async function markFailed(id: string, error: string): Promise<EmailRow> {
  const { rows } = await pool.query<EmailRow>(
    `UPDATE emails SET status = 'failed', sent_at = now(), error = $2, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, error.slice(0, 1000)],
  );
  return rows[0];
}

/** Put back to scheduled after a transient error (job will be retried by BullMQ). */
export async function markRetrying(id: string, error: string): Promise<void> {
  await pool.query(
    `UPDATE emails SET status = 'scheduled', error = $2, updated_at = now() WHERE id = $1 AND status = 'sending'`,
    [id, error.slice(0, 1000)],
  );
}

/**
 * Delete one of the user's emails unless a worker is sending it right now.
 * A pending email's BullMQ job may still fire afterwards; the worker's claim then
 * finds no row and treats the job as a no-op, so a deleted email is never sent.
 */
export async function deleteEmail(userId: string, id: string): Promise<'deleted' | 'not_found' | 'sending'> {
  const { rowCount } = await pool.query(
    `DELETE FROM emails WHERE id = $1 AND user_id = $2 AND status <> 'sending'`,
    [id, userId],
  );
  if (rowCount) return 'deleted';
  const { rows } = await pool.query('SELECT 1 FROM emails WHERE id = $1 AND user_id = $2', [id, userId]);
  return rows.length ? 'sending' : 'not_found';
}

export async function markRateLimited(id: string, newTime: Date): Promise<EmailRow> {
  const { rows } = await pool.query<EmailRow>(
    `UPDATE emails SET status = 'rate_limited', scheduled_at = $2,
       reschedule_count = reschedule_count + 1, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, newTime],
  );
  return rows[0];
}

/** Emails that should have a BullMQ job (used by startup reconciliation). */
export async function listPendingIds(afterId: string | null, limit: number) {
  const { rows } = await pool.query<{ id: string; scheduled_at: Date }>(
    `SELECT id, scheduled_at FROM emails
     WHERE status IN ('scheduled','rate_limited','sending') AND ($1::uuid IS NULL OR id > $1::uuid)
     ORDER BY id LIMIT $2`,
    [afterId, limit],
  );
  return rows;
}
