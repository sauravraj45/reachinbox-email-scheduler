import { Queue } from 'bullmq';
import { config } from '../config';

export const EMAIL_QUEUE = 'email-send';

export interface EmailJobData {
  emailId: string;
}

export const bullConnection = { url: config.REDIS_URL, maxRetriesPerRequest: null };

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: config.JOB_ATTEMPTS,
    backoff: { type: 'exponential', delay: 10_000 },
    // Keep history bounded; the DB is the long-term record.
    removeOnComplete: { age: 24 * 3600, count: 5000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

/**
 * The BullMQ job id IS the email id. BullMQ refuses to add a second job with an
 * existing id, so enqueueing the same email twice (API retry, startup
 * reconciliation, multiple instances) can never create a duplicate send.
 */
export const jobIdFor = (emailId: string) => `email-${emailId}`;

export async function enqueueEmails(items: { id: string; scheduledAt: Date }[]): Promise<void> {
  const now = Date.now();
  const CHUNK = 500;
  for (let i = 0; i < items.length; i += CHUNK) {
    await emailQueue.addBulk(
      items.slice(i, i + CHUNK).map((e) => ({
        name: 'send',
        data: { emailId: e.id },
        opts: { jobId: jobIdFor(e.id), delay: Math.max(0, e.scheduledAt.getTime() - now) },
      })),
    );
  }
}
