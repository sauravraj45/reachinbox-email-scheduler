import type { PoolClient } from 'pg';
import { pool } from '../db/pool';

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;

export interface AttachmentMeta {
  id: string;
  filename: string;
  content_type: string;
  size: number;
}

export interface AttachmentFile extends AttachmentMeta {
  data: Buffer;
}

export const toAttachmentDto = (a: AttachmentMeta) => ({
  id: a.id,
  filename: a.filename,
  contentType: a.content_type,
  size: a.size,
});

export async function createAttachment(p: { userId: string; filename: string; contentType: string; data: Buffer }): Promise<AttachmentMeta> {
  const { rows } = await pool.query<AttachmentMeta>(
    `INSERT INTO attachments (user_id, filename, content_type, size, data) VALUES ($1,$2,$3,$4,$5)
     RETURNING id, filename, content_type, size`,
    [p.userId, p.filename, p.contentType, p.data.length, p.data],
  );
  return rows[0];
}

export async function getAttachmentForUser(userId: string, id: string): Promise<AttachmentFile | null> {
  const { rows } = await pool.query<AttachmentFile>(
    'SELECT id, filename, content_type, size, data FROM attachments WHERE id = $1 AND user_id = $2',
    [id, userId],
  );
  return rows[0] ?? null;
}

/** Only drafts (not yet linked to a campaign) can be deleted; scheduled emails keep theirs. */
export async function deleteDraftAttachment(userId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM attachments WHERE id = $1 AND user_id = $2 AND campaign_id IS NULL', [id, userId]);
  return Boolean(rowCount);
}

/** Link the user's draft uploads to a new campaign (inside the scheduling transaction). */
export async function linkAttachments(client: PoolClient, userId: string, campaignId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { rowCount } = await client.query(
    'UPDATE attachments SET campaign_id = $1 WHERE id = ANY($2::uuid[]) AND user_id = $3 AND campaign_id IS NULL',
    [campaignId, ids, userId],
  );
  if (rowCount !== ids.length) {
    throw Object.assign(new Error('One or more attachments are invalid or already used'), { status: 400 });
  }
}

export async function listCampaignAttachmentMeta(campaignId: string): Promise<AttachmentMeta[]> {
  const { rows } = await pool.query<AttachmentMeta>(
    'SELECT id, filename, content_type, size FROM attachments WHERE campaign_id = $1 ORDER BY created_at',
    [campaignId],
  );
  return rows;
}

// Worker-side cache: a campaign's files are read once, not once per email (1000s of sends).
const cache = new Map<string, { at: number; files: AttachmentFile[] }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function getCampaignAttachmentFiles(campaignId: string): Promise<AttachmentFile[]> {
  const hit = cache.get(campaignId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.files;
  const { rows } = await pool.query<AttachmentFile>(
    'SELECT id, filename, content_type, size, data FROM attachments WHERE campaign_id = $1 ORDER BY created_at',
    [campaignId],
  );
  if (cache.size > 50) cache.clear();
  cache.set(campaignId, { at: Date.now(), files: rows });
  return rows;
}
