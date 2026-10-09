import dotenv from 'dotenv';

dotenv.config({ quiet: true });
import { z } from 'zod';

const int = (def: number) => z.coerce.number().int().positive().default(def);

const schema = z.object({
  PORT: int(4000),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  BACKEND_URL: z.string().default('http://localhost:4000'),
  DATABASE_URL: z.string().default('postgres://reachinbox:reachinbox@localhost:5433/reachinbox'),
  REDIS_URL: z.string().default('redis://localhost:6380'),
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),
  ELASTICSEARCH_INDEX: z.string().default('emails'),
  JWT_SECRET: z.string().min(8).default('dev-secret-change-me'),

  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),

  SLACK_CLIENT_ID: z.string().default(''),
  SLACK_CLIENT_SECRET: z.string().default(''),
  SLACK_REDIRECT_URI: z.string().default(''),

  ETHEREAL_SENDERS: z.string().default(''),
  ETHEREAL_SENDER_COUNT: int(3),

  WORKER_CONCURRENCY: int(5),
  MIN_DELAY_BETWEEN_SENDS_MS: z.coerce.number().int().nonnegative().default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: int(200),
  DEFAULT_CAMPAIGN_HOURLY_LIMIT: int(100),
  JOB_ATTEMPTS: int(5),

  BULL_BOARD_USER: z.string().default(''),
  BULL_BOARD_PASS: z.string().default(''),
});

// Treat empty strings in .env as "unset" so defaults apply
const env = Object.fromEntries(
  Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ''),
);

export const config = schema.parse(env);

export const slackRedirectUri = () =>
  config.SLACK_REDIRECT_URI || `${config.BACKEND_URL}/slack/oauth/callback`;
