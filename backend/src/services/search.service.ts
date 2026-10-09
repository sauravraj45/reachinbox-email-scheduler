import { Client } from '@elastic/elasticsearch';
import { config } from '../config';
import type { EmailRow } from './emails.repo';

const es = new Client({ node: config.ELASTICSEARCH_URL });
const index = config.ELASTICSEARCH_INDEX;

interface EmailDoc {
  id: string;
  user_id: string;
  campaign_id: string;
  sender_id: number;
  to_email: string;
  subject: string;
  body: string;
  status: string;
  scheduled_at: string;
  sent_at: string | null;
}

const toDoc = (e: EmailRow): EmailDoc => ({
  id: e.id,
  user_id: e.user_id,
  campaign_id: e.campaign_id,
  sender_id: e.sender_id,
  to_email: e.to_email,
  subject: e.subject,
  body: e.body,
  status: e.status,
  scheduled_at: new Date(e.scheduled_at).toISOString(),
  sent_at: e.sent_at ? new Date(e.sent_at).toISOString() : null,
});

export async function ensureIndex(): Promise<void> {
  try {
    const exists = await es.indices.exists({ index });
    if (exists) return;
    await es.indices.create({
      index,
      mappings: {
        properties: {
          id: { type: 'keyword' },
          user_id: { type: 'keyword' },
          campaign_id: { type: 'keyword' },
          sender_id: { type: 'integer' },
          to_email: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          subject: { type: 'text' },
          body: { type: 'text' },
          status: { type: 'keyword' },
          scheduled_at: { type: 'date' },
          sent_at: { type: 'date' },
        },
      },
    });
    console.log(`[es] created index "${index}"`);
  } catch (err) {
    console.warn('[es] could not ensure index (search will fall back to SQL):', (err as Error).message);
  }
}

// Indexing is best-effort: the DB is the source of truth, and a search outage
// must never block scheduling or sending.
export async function indexEmails(rows: EmailRow[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    const operations = rows.flatMap((r) => [{ index: { _index: index, _id: r.id } }, toDoc(r)]);
    const res = await es.bulk({ operations, refresh: false });
    if (res.errors) console.warn('[es] bulk index reported item errors');
  } catch (err) {
    console.warn('[es] bulk index failed:', (err as Error).message);
  }
}

export async function removeEmailFromIndex(id: string): Promise<void> {
  try {
    await es.delete({ index, id });
  } catch (err) {
    console.warn('[es] delete failed:', (err as Error).message);
  }
}

export async function indexEmail(row: EmailRow): Promise<void> {
  try {
    await es.index({ index, id: row.id, document: toDoc(row) });
  } catch (err) {
    console.warn('[es] index failed:', (err as Error).message);
  }
}

export async function searchEmails(params: {
  userId: string;
  q: string;
  statuses: string[];
  from: number;
  size: number;
}): Promise<{ ids: string[]; total: number }> {
  const res = await es.search<EmailDoc>({
    index,
    from: params.from,
    size: params.size,
    query: {
      bool: {
        filter: [{ term: { user_id: params.userId } }, { terms: { status: params.statuses } }],
        must: [
          {
            multi_match: {
              query: params.q,
              fields: ['to_email^3', 'subject^2', 'body'],
              type: 'bool_prefix',
              operator: 'and',
            },
          },
        ],
      },
    },
    sort: [{ _score: { order: 'desc' } }, { scheduled_at: { order: 'desc' } }],
  });
  const total = typeof res.hits.total === 'number' ? res.hits.total : (res.hits.total?.value ?? 0);
  return { ids: res.hits.hits.map((h) => h._id as string), total };
}
