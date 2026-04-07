// src/infrastructure/redis/redis.client.ts
//
// FIX SUMMARY:
//   1. Restored all exports (cache, CacheKeys, disconnectRedis) that were
//      accidentally commented out — caused crashes in token.service, analytics, etc.
//   2. Added connectWithRetry() so server.ts waits for the 'ready' event
//      instead of calling ping() on an unready connection.
//   3. createBullConnection() returns a SEPARATE Redis instance for BullMQ —
//      BullMQ uses blocking commands and must NOT share the app connection.

import { Redis, type RedisOptions } from 'ioredis';
import { config } from '@shared/config';
import { createLogger } from '@infrastructure/logger';

const log = createLogger('RedisClient');

// ─── Shared connection options ────────────────────────────────────────────────
function buildOptions(db = 0): RedisOptions {
  return {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD || undefined,
    db,

    // ✅ FIXED TLS
    tls: config.REDIS_TLS === "true" ? {} : undefined,

    // ✅ FIXED retry crash
    maxRetriesPerRequest: null,

    enableReadyCheck: true,
    lazyConnect: true,
    connectTimeout: 10_000,

    retryStrategy(times: number) {
      if (times > 10) {
        log.error('Redis max reconnect attempts exceeded');
        return null;
      }
      return Math.min(times * 200, 3000);
    },
  };
}

// ─── App Singleton ────────────────────────────────────────────────────────────
let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;

  _redis = new Redis(buildOptions(config.REDIS_DB));

  _redis.on('connect',     () => log.info('Redis connected'));
  _redis.on('ready',       () => log.info('Redis ready'));
  _redis.on('error',  (err) => log.error({ err }, 'Redis error'));
  _redis.on('close',       () => log.warn('Redis connection closed'));
  _redis.on('reconnecting',() => log.info('Redis reconnecting...'));

  return _redis;
}

// ─── Connect and wait for 'ready' ────────────────────────────────────────────
// Call this from server.ts instead of just ping() — ensures the connection
// is actually established before any commands are issued.
export async function connectRedis(): Promise<void> {
  const redis = getRedis();

  // Already ready
  if (redis.status === 'ready') return;

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Redis connection timeout after 15s'));
    }, 15_000);

    redis.once('ready', () => {
      clearTimeout(timeout);
      log.info('Redis connection confirmed ready');
      resolve();
    });

    redis.once('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    // Trigger connection (lazyConnect = true means connect() must be called)
    redis.connect().catch(reject);
  });
}

// ─── Dedicated BullMQ connection ─────────────────────────────────────────────
// BullMQ uses BLPOP and other blocking commands. These MUST run on a separate
// connection — sharing with the app connection causes command queuing and timeouts.
export function createBullConnection(): Redis {
  const conn = new Redis(buildOptions(config.REDIS_DB));

  // BullMQ manages its own lifecycle — just log events
  conn.on('error', (err) => log.error({ err }, 'BullMQ Redis error'));
  conn.on('connect',  () => log.info('BullMQ Redis connected'));
  conn.on('ready',    () => log.info('BullMQ Redis ready'));
  conn.on('reconnecting', () => log.info('BullMQ Redis reconnecting...'));

  return conn;
}

// ─── Graceful disconnect ──────────────────────────────────────────────────────
export async function disconnectRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
    log.info('Redis disconnected');
  }
}

// ─── Cache helpers ────────────────────────────────────────────────────────────
const DEFAULT_TTL = 300; // 5 minutes

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const val = await getRedis().get(key);
      if (!val) return null;
      return JSON.parse(val) as T;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, value: T, ttlSeconds = DEFAULT_TTL): Promise<void> {
    await getRedis().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  },

  async del(key: string): Promise<void> {
    await getRedis().del(key);
  },

  async delPattern(pattern: string): Promise<void> {
    const keys = await getRedis().keys(pattern);
    if (keys.length > 0) await getRedis().del(...keys);
  },

  async exists(key: string): Promise<boolean> {
    return (await getRedis().exists(key)) === 1;
  },

  async ttl(key: string): Promise<number> {
    return getRedis().ttl(key);
  },
};

// ─── Cache key builders ───────────────────────────────────────────────────────
export const CacheKeys = {
  tokenBlacklist:    (jti: string)                    => `blacklist:token:${jti}`,
  analyticsOverview: (userId: string)                 => `analytics:overview:${userId}`,
  analyticsMonthly:  (userId: string, year: number)   => `analytics:monthly:${userId}:${year}`,
  analyticsCategory: (userId: string, period: string) => `analytics:category:${userId}:${period}`,
  userSession:       (userId: string, sessionId: string) => `session:${userId}:${sessionId}`,
  rateLimitAuth:     (ip: string)                     => `ratelimit:auth:${ip}`,
} as const;
