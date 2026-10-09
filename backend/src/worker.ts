import { Worker } from 'bullmq';
import { config } from './config';
import { migrate } from './db/migrate';
import { pool } from './db/pool';
import { redis } from './lib/redis';
import { bullConnection, EMAIL_QUEUE, emailQueue, EmailJobData } from './queue/queue';
import { LOCK_DURATION_MS, processEmailJob } from './queue/processor';
import { reconcilePendingJobs } from './queue/recovery';
import { ensureIndex } from './services/search.service';

async function main() {
  await migrate();
  await ensureIndex();

  const restored = await reconcilePendingJobs();
  if (restored) console.log(`[worker] reconciliation re-enqueued ${restored} pending email(s) from the DB`);

  const worker = new Worker<EmailJobData>(EMAIL_QUEUE, processEmailJob, {
    connection: bullConnection,
    concurrency: config.WORKER_CONCURRENCY,
    lockDuration: LOCK_DURATION_MS,
    maxStalledCount: 3,
  });

  worker.on('failed', (job, err) => {
    if (job) console.warn(`[worker] job ${job.id} failed (attempt ${job.attemptsMade}): ${err.message}`);
  });
  worker.on('error', (err) => console.error('[worker] error', err));

  console.log(
    `[worker] started: concurrency=${config.WORKER_CONCURRENCY}, ` +
      `minGap=${config.MIN_DELAY_BETWEEN_SENDS_MS}ms/sender, ` +
      `maxPerHourPerSender=${config.MAX_EMAILS_PER_HOUR_PER_SENDER}`,
  );

  // Graceful shutdown: let in-flight sends finish; delayed jobs stay safely in Redis.
  
  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} received, closing...`);
    await worker.close();
    await emailQueue.close();
    redis.disconnect();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[worker] fatal', err);
  process.exit(1);
});
