import { pool } from './pool';

// Idempotent schema. Runs on every boot of the API and the worker
// (guarded by an advisory lock so concurrent boots don't race).
const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id   TEXT UNIQUE NOT NULL,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slack_connections (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  team_id       TEXT,
  team_name     TEXT,
  channel       TEXT,
  webhook_url   TEXT NOT NULL,
  access_token  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS senders (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  smtp_host   TEXT NOT NULL,
  smtp_port   INT NOT NULL,
  smtp_user   TEXT NOT NULL,
  smtp_pass   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id     INT NOT NULL REFERENCES senders(id),
  subject       TEXT NOT NULL,
  body          TEXT NOT NULL,
  start_at      TIMESTAMPTZ NOT NULL,
  delay_ms      INT NOT NULL,
  hourly_limit  INT NOT NULL,
  total         INT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emails (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id        UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id          INT NOT NULL REFERENCES senders(id),
  seq                INT NOT NULL,
  to_email           TEXT NOT NULL,
  subject            TEXT NOT NULL,
  body               TEXT NOT NULL,
  scheduled_at       TIMESTAMPTZ NOT NULL,
  status             TEXT NOT NULL DEFAULT 'scheduled'
                       CHECK (status IN ('scheduled','rate_limited','sending','sent','failed')),
  sent_at            TIMESTAMPTZ,
  error              TEXT,
  message_id         TEXT,
  preview_url        TEXT,
  attempts           INT NOT NULL DEFAULT 0,
  reschedule_count   INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, to_email)
);

-- Uploaded once by the user, linked to a campaign on schedule, attached to every email of it.
-- Stored in Postgres (bytea) so any worker instance can read them; size-capped by the API.
CREATE TABLE IF NOT EXISTS attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id   UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  content_type  TEXT NOT NULL,
  size          INT NOT NULL,
  data          BYTEA NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attachments_campaign_idx ON attachments (campaign_id);

CREATE INDEX IF NOT EXISTS emails_user_status_sched_idx ON emails (user_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS emails_pending_idx ON emails (status) WHERE status IN ('scheduled','rate_limited','sending');
`;

export async function migrate(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(424242)');
    await client.query(SCHEMA);
  } finally {
    await client.query('SELECT pg_advisory_unlock(424242)').catch(() => undefined);
    client.release();
  }
}
