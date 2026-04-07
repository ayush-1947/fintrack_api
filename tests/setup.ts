// tests/setup.ts
import 'dotenv/config';

// ─── Environment overrides for test ──────────────────────────────────────────
process.env.NODE_ENV             = 'test';
process.env.DATABASE_URL         = process.env.TEST_DATABASE_URL ?? 'postgresql://fintrack:fintrack_pass@localhost:5432/fintrack_test?schema=public';
process.env.REDIS_HOST           = 'localhost';
process.env.REDIS_PORT           = '6379';
process.env.JWT_ACCESS_SECRET    = 'test_access_secret_that_is_long_enough_32chars';
process.env.JWT_REFRESH_SECRET   = 'test_refresh_secret_that_is_long_enough_32chars';
process.env.JWT_ACCESS_EXPIRES_IN  = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.SMTP_HOST            = 'localhost';
process.env.SMTP_PORT            = '1025';
process.env.SMTP_FROM            = 'test@fintrack.io';
process.env.APP_URL              = 'http://localhost:3000';
process.env.APP_NAME             = 'FinTrack';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
process.env.AUTH_RATE_LIMIT_MAX     = '1000';
process.env.LOG_LEVEL            = 'silent';
process.env.ENABLE_REQUEST_LOGGING = 'false';

// ─── Global mocks ─────────────────────────────────────────────────────────────
jest.mock('@infrastructure/redis/redis.client', () => ({
  getRedis:  jest.fn().mockReturnValue({
    get:    jest.fn().mockResolvedValue(null),
    set:    jest.fn().mockResolvedValue('OK'),
    del:    jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    keys:   jest.fn().mockResolvedValue([]),
    call:   jest.fn(),
    ping:   jest.fn().mockResolvedValue('PONG'),
    quit:   jest.fn().mockResolvedValue('OK'),
  }),
  cache: {
    get:        jest.fn().mockResolvedValue(null),
    set:        jest.fn().mockResolvedValue(undefined),
    del:        jest.fn().mockResolvedValue(undefined),
    delPattern: jest.fn().mockResolvedValue(undefined),
    exists:     jest.fn().mockResolvedValue(false),
    ttl:        jest.fn().mockResolvedValue(-1),
  },
  CacheKeys:       {
    tokenBlacklist:    jest.fn((jti: string) => `blacklist:token:${jti}`),
    analyticsOverview: jest.fn((uid: string) => `analytics:overview:${uid}`),
    analyticsMonthly:  jest.fn((uid: string, y: number) => `analytics:monthly:${uid}:${y}`),
    analyticsCategory: jest.fn((uid: string, p: string) => `analytics:category:${uid}:${p}`),
    userSession:       jest.fn(),
    rateLimitAuth:     jest.fn(),
  },
  disconnectRedis: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@infrastructure/queue', () => ({
  QUEUES:       { EMAIL: 'email', ANALYTICS: 'analytics-compute', AUDIT: 'audit-log' },
  getQueue:     jest.fn().mockReturnValue({ add: jest.fn().mockResolvedValue({ id: 'test-job-id' }) }),
  createWorker: jest.fn(),
  closeQueues:  jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@infrastructure/events/eventBus', () => ({
  Events: {
    USER_REGISTERED:     'user.registered',
    USER_LOGGED_IN:      'user.logged_in',
    USER_PASSWORD_RESET: 'user.password_reset',
    TRANSACTION_CREATED: 'transaction.created',
    TRANSACTION_UPDATED: 'transaction.updated',
    TRANSACTION_DELETED: 'transaction.deleted',
  },
  eventBus: {
    publish:     jest.fn(),
    subscribe:   jest.fn(),
    unsubscribe: jest.fn(),
  },
}));

jest.mock('@services/auth/infrastructure/services/email.service', () => ({
  emailService: {
    sendVerificationEmail:  jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendWelcomeEmail:       jest.fn().mockResolvedValue(undefined),
  },
  EmailService: jest.fn(),
}));

// ─── Global afterAll ──────────────────────────────────────────────────────────
afterAll(async () => {
  // Disconnect Prisma in integration tests
  const { prisma } = await import('@infrastructure/database/prisma.client');
  await prisma.$disconnect().catch(() => {});
});
