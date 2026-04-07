// src/infrastructure/logger/index.ts
import pino from 'pino';
import { config, isDev } from '@shared/config';

const transport = isDev
  ? pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    })
  : undefined;

export const logger = pino(
  {
    level: config.LOG_LEVEL,
    base: { service: config.APP_NAME, env: config.NODE_ENV },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
    redact: {
      paths: ['req.headers.authorization', '*.password', '*.passwordHash', '*.token'],
      censor: '[REDACTED]',
    },
  },
  transport,
);

export type Logger = typeof logger;

// Child logger factory for service-level context
export const createLogger = (service: string, extra?: Record<string, unknown>) =>
  logger.child({ service, ...extra });
