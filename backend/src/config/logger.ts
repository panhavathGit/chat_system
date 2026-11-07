import { pino } from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: ['req.headers.authorization', 'req.body.password'],
  ...(env.NODE_ENV === 'development' && {
    transport: { target: 'pino-pretty', options: { colorize: true } },
  }),
});
