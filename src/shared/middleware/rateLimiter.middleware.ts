// src/shared/middleware/rateLimiter.middleware.ts
//
// FIX: Rate limiter now falls back to in-memory store gracefully when
// Redis is unavailable, preventing startup failures. Uses dynamic require
// so a missing Redis connection does not crash the process.

import rateLimit from 'express-rate-limit';
import { config } from '@shared/config';
import { ErrorCode } from '@shared/errors/AppError';

function makeRedisStore(prefix: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RedisStore = require('rate-limit-redis') as typeof import('rate-limit-redis');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getRedis } = require('@infrastructure/redis/redis.client') as typeof import('@infrastructure/redis/redis.client');
    return new RedisStore({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sendCommand: (...args: string[]) => (getRedis() as any).call(...args),
      prefix,
    });
  } catch {
    return undefined; // falls back to memory store — still works, just not distributed
  }
}

const commonOptions = (store: ReturnType<typeof makeRedisStore>) => ({
  store,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: import('express').Request) => req.ip ?? 'unknown',
  skip: (req: import('express').Request) =>
    req.path === '/health' || req.path.startsWith('/api-docs'),
});

export const apiRateLimiter = rateLimit({
  ...commonOptions(makeRedisStore('rl:api:')),
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max:      config.RATE_LIMIT_MAX_REQUESTS,
  handler: (_req, res) => {
    res.status(429).json({
      error:     'Too many requests. Please slow down.',
      errorCode: ErrorCode.TOO_MANY_REQUESTS,
    });
  },
});

export const authRateLimiter = rateLimit({
  ...commonOptions(makeRedisStore('rl:auth:')),
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max:      config.AUTH_RATE_LIMIT_MAX,
  handler: (_req, res) => {
    res.status(429).json({
      error:     'Too many authentication attempts. Try again later.',
      errorCode: ErrorCode.TOO_MANY_REQUESTS,
    });
  },
});
