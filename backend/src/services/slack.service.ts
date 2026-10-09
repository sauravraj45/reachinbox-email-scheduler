import { config, slackRedirectUri } from '../config';
import { pool } from '../db/pool';

export interface SlackConnection {
  user_id: string;
  team_id: string | null;
  team_name: string | null;
  channel: string | null;
  webhook_url: string;
  access_token: string | null;
}

export const slackConfigured = () => Boolean(config.SLACK_CLIENT_ID && config.SLACK_CLIENT_SECRET);

export function slackAuthorizeUrl(state: string): string {
  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.searchParams.set('client_id', config.SLACK_CLIENT_ID);
  url.searchParams.set('scope', 'incoming-webhook');
  url.searchParams.set('redirect_uri', slackRedirectUri());
  url.searchParams.set('state', state);
  return url.toString();
}

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  team?: { id: string; name: string };
  incoming_webhook?: { channel: string; url: string };
}

export async function exchangeSlackCode(userId: string, code: string): Promise<SlackConnection> {
  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.SLACK_CLIENT_ID,
      client_secret: config.SLACK_CLIENT_SECRET,
      redirect_uri: slackRedirectUri(),
    }),
  });
  const data = (await res.json()) as SlackOAuthResponse;
  if (!data.ok || !data.incoming_webhook) {
    throw new Error(`Slack OAuth failed: ${data.error ?? 'no incoming webhook returned'}`);
  }
  const { rows } = await pool.query<SlackConnection>(
    `INSERT INTO slack_connections (user_id, team_id, team_name, channel, webhook_url, access_token)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id) DO UPDATE SET team_id = EXCLUDED.team_id, team_name = EXCLUDED.team_name,
       channel = EXCLUDED.channel, webhook_url = EXCLUDED.webhook_url,
       access_token = EXCLUDED.access_token, updated_at = now()
     RETURNING *`,
    [userId, data.team?.id ?? null, data.team?.name ?? null, data.incoming_webhook.channel,
      data.incoming_webhook.url, data.access_token ?? null],
  );
  return rows[0];
}

export async function getSlackConnection(userId: string): Promise<SlackConnection | null> {
  const { rows } = await pool.query<SlackConnection>('SELECT * FROM slack_connections WHERE user_id = $1', [userId]);
  return rows[0] ?? null;
}

export async function disconnectSlack(userId: string): Promise<void> {
  await pool.query('DELETE FROM slack_connections WHERE user_id = $1', [userId]);
}

/**
 * Post to the user's connected Slack channel. The connection is read from the DB on
 * every call, so connecting/disconnecting takes effect immediately (no redeploy).
 * Never throws: a missing connection or a Slack error must not break sending.
 */
export async function notifySlack(userId: string, text: string, blocks?: unknown[]): Promise<boolean> {
  try {
    const conn = await getSlackConnection(userId);
    if (!conn) return false;
    const res = await fetch(conn.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, blocks }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[slack] webhook responded ${res.status}: ${body}`);
      // Webhook revoked / channel deleted: drop the stale connection so the UI shows "Connect".
      if (res.status === 403 || res.status === 404 || body.includes('no_service')) await disconnectSlack(userId);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[slack] notify failed:', (err as Error).message);
    return false;
  }
}
