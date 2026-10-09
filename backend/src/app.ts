import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { ZodError } from 'zod';
import { config } from './config';
import { emailQueue } from './queue/queue';
import authRoutes from './routes/auth.routes';
import slackRoutes from './routes/slack.routes';
import apiRoutes from './routes/api.routes';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(cors({ origin: config.FRONTEND_URL, credentials: true }));
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // Live BullMQ dashboard
  const boardAdapter = new ExpressAdapter();
  boardAdapter.setBasePath('/admin/queues');
  createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter: boardAdapter });
  if (config.BULL_BOARD_USER) {
    app.use('/admin/queues', (req, res, next) => {
      const expected = 'Basic ' + Buffer.from(`${config.BULL_BOARD_USER}:${config.BULL_BOARD_PASS}`).toString('base64');
      if (req.headers.authorization === expected) return next();
      res.set('WWW-Authenticate', 'Basic realm="bull-board"').status(401).send('Authentication required');
    });
  }
  app.use('/admin/queues', boardAdapter.getRouter());

  app.use('/auth', authRoutes);
  app.use('/slack', slackRoutes);
  app.use('/api', apiRoutes);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const e = err as Error & { status?: number };
    if (!e.status || e.status >= 500) console.error('[api] error', err);
    res.status(e.status ?? 500).json({ error: e.status ? e.message : 'Internal server error' });
  });

  return app;
}
