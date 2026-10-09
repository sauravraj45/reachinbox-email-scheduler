import { z } from 'zod';
import { config } from '../config';
import { pool } from '../db/pool';

export interface SenderRow {
  id: number;
  name: string;
  email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
}

export type PublicSender = Pick<SenderRow, 'id' | 'name' | 'email'>;

const envSenders = z.array(
  z.object({
    name: z.string().optional(),
    user: z.string().email(),
    pass: z.string().min(1),
    host: z.string().default('smtp.ethereal.email'),
    port: z.number().int().default(587),
  }),
);

const DEFAULT_NAMES = ['Oliver Brown', 'Ava Wilson', 'Noah Taylor', 'Mia Davies', 'Liam Evans'];

/**
 * Same endpoint nodemailer.createTestAccount() uses, called directly because
 * nodemailer caches the first account per process (we need several distinct senders).
 */
async function createEtherealAccount(): Promise<{ user: string; pass: string; smtp: { host: string; port: number } }> {
  const res = await fetch('https://api.nodemailer.com/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestor: 'reachinbox-scheduler', version: '1.0.0' }),
  });
  const data = (await res.json()) as { status?: string; error?: string; user: string; pass: string; smtp: { host: string; port: number } };
  if (data.status !== 'success') throw new Error(`Ethereal account creation failed: ${data.error ?? res.status}`);
  return data;
}

/**
 * Make sure there are Ethereal sender accounts in the DB.
 * - ETHEREAL_SENDERS (JSON) is upserted if provided.
 * - Otherwise, on the very first boot, ETHEREAL_SENDER_COUNT accounts are created via
 *   nodemailer.createTestAccount() and persisted, so they stay stable across restarts.
 */
export async function ensureSenders(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(424243)');

    if (config.ETHEREAL_SENDERS) {
      const list = envSenders.parse(JSON.parse(config.ETHEREAL_SENDERS));
      for (const [i, s] of list.entries()) {
        await client.query(
          `INSERT INTO senders (name, email, smtp_host, smtp_port, smtp_user, smtp_pass)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, smtp_host = EXCLUDED.smtp_host,
             smtp_port = EXCLUDED.smtp_port, smtp_user = EXCLUDED.smtp_user, smtp_pass = EXCLUDED.smtp_pass`,
          [s.name ?? DEFAULT_NAMES[i % DEFAULT_NAMES.length], s.user, s.host, s.port, s.user, s.pass],
        );
      }
      return;
    }

    const { rows } = await client.query<{ count: string }>('SELECT count(*) FROM senders');
    const existing = Number(rows[0].count);
    const missing = config.ETHEREAL_SENDER_COUNT - existing;
    for (let i = 0; i < missing; i++) {
      const acc = await createEtherealAccount();
      await client.query(
        `INSERT INTO senders (name, email, smtp_host, smtp_port, smtp_user, smtp_pass)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [DEFAULT_NAMES[(existing + i) % DEFAULT_NAMES.length], acc.user, acc.smtp.host, acc.smtp.port, acc.user, acc.pass],
      );
      console.log(`[senders] created Ethereal account ${acc.user} (pass: ${acc.pass})`);
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(424243)').catch(() => undefined);
    client.release();
  }
}

export async function listSenders(): Promise<PublicSender[]> {
  const { rows } = await pool.query<PublicSender>('SELECT id, name, email FROM senders ORDER BY id');
  return rows;
}

export async function getSender(id: number): Promise<SenderRow | null> {
  const { rows } = await pool.query<SenderRow>('SELECT * FROM senders WHERE id = $1', [id]);
  return rows[0] ?? null;
}
