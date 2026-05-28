import { pino } from 'pino';
import { loadEnv } from '../config/env.js';

const env = loadEnv();

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
    },
  }),
});
