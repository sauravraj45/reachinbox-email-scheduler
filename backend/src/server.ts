import { config } from './config';
import { createApp } from './app';
import { migrate } from './db/migrate';
import { pool } from './db/pool';
import { redis } from './lib/redis';
import { emailQueue } from './queue/queue';
import { ensureIndex } from './services/search.service';
import { ensureSenders } from './services/senders.service';

async function main() {
  await migrate();
  await ensureSenders();
  await ensureIndex();

  const server = createApp().listen(config.PORT, () => {
    console.log(`[api] listening on ${config.BACKEND_URL} (bull board: ${config.BACKEND_URL}/admin/queues)`);
  });

  const shutdown = (signal: string) => {
    console.log(`[api] ${signal} received, closing...`);
    server.close(async () => {
      await emailQueue.close();
      redis.disconnect();
      await pool.end();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[api] fatal', err);
  process.exit(1);
});
