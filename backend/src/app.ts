import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from '@config/env.js';
import { logger } from '@config/logger.js';
import { errorHandler, notFoundHandler } from '@shared/middleware/error.middleware.js';
import { agentV1Router, customerV1Router } from './routes/v1.js';

export const app = express();

app.use(helmet());
app.use(
  cors({
    // * No CORS_ORIGIN configured: allow any origin in development, none in production
    origin: env.CORS_ORIGIN.length > 0 ? env.CORS_ORIGIN : env.NODE_ENV !== 'production',
  }),
);
app.use(
  pinoHttp({
    logger,
    serializers: {
      req: (req: { id: unknown; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  }),
);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'success', data: { uptime: process.uptime() } });
});

app.use('/customer/api/v1', customerV1Router);
app.use('/agent/api/v1', agentV1Router);

app.use(notFoundHandler);
app.use(errorHandler);
