import IORedis from 'ioredis';
import { config } from '../config';

// Shared connection for app-level keys (rate-limit counters, send-gap slots, alert flags).
// BullMQ creates and manages its own connections (see queue/queue.ts).
export const redis = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
