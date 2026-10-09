import { emailQueue, jobIdFor } from './queue';
import { listPendingIds } from '../services/emails.repo';

/**
 * Startup reconciliation: the DB is the source of truth for what still has to be sent.
 * Normally every pending email already has its delayed job in Redis (AOF-persisted),
 * so this is a cheap no-op. If Redis lost data, or a job ended up completed/failed
 * while the row is still pending, the job is (re)created with the same deterministic
 * job id, at the row's scheduled_at. Already-sent rows are never touched, so nothing
 * restarts "from day 1" and nothing is sent twice.
 */
export async function reconcilePendingJobs(): Promise<number> {
  let after: string | null = null;
  let restored = 0;
  for (;;) {
    const batch = await listPendingIds(after, 500);
    if (batch.length === 0) break;
    after = batch[batch.length - 1].id;

    const toAdd: typeof batch = [];
    await Promise.all(
      batch.map(async (row) => {
        const job = await emailQueue.getJob(jobIdFor(row.id));
        if (!job) return toAdd.push(row);
        const state = await job.getState();
        if (state === 'completed' || state === 'failed') {
          await job.remove();
          toAdd.push(row);
        }
      }),
    );

    if (toAdd.length) {
      const now = Date.now();
      await emailQueue.addBulk(
        toAdd.map((r) => ({
          name: 'send',
          data: { emailId: r.id },
          opts: { jobId: jobIdFor(r.id), delay: Math.max(0, new Date(r.scheduled_at).getTime() - now) },
        })),
      );
      restored += toAdd.length;
    }
  }
  return restored;
}
