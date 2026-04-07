// src/infrastructure/queue/index.ts
//
// FIX: BullMQ now gets its OWN Redis connection via createBullConnection().
// Previously it shared getRedis() — BullMQ uses blocking commands (BLPOP, etc.)
// which deadlock when mixed with regular app commands on the same connection.

import { Queue, Worker, type Processor } from 'bullmq';
import { createBullConnection } from '@infrastructure/redis/redis.client';
import { createLogger } from '@infrastructure/logger';

const log = createLogger('QueueManager');

// ─── Queue Names ──────────────────────────────────────────────────────────────
export const QUEUES = {
  EMAIL:     'email',
  ANALYTICS: 'analytics-compute',
  AUDIT:     'audit-log',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

// ─── Job payload types ────────────────────────────────────────────────────────
export interface EmailJobData {
  type: 'VERIFY_EMAIL' | 'PASSWORD_RESET' | 'WELCOME';
  to: string;
  payload: Record<string, string>;
}

export interface AnalyticsJobData {
  type: 'RECOMPUTE_MONTHLY_SNAPSHOT';
  userId: string;
  year: number;
  month: number;
}

export interface AuditJobData {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// ─── Queue factory ────────────────────────────────────────────────────────────
const queues = new Map<string, Queue>();

export function getQueue<T = unknown>(name: QueueName): Queue<T> {
  if (!queues.has(name)) {
    const q = new Queue<T>(name, {
      // Each queue gets its own connection — BullMQ requirement
      connection: createBullConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 100 },
        removeOnFail:     { count: 50 },
      },
    });

    q.on('error', (err) => log.error({ queue: name, err }, 'Queue error'));
    queues.set(name, q);
  }
  return queues.get(name) as Queue<T>;
}

// ─── Worker factory ───────────────────────────────────────────────────────────
const workers: Worker[] = [];

export function createWorker<T>(
  name: QueueName,
  processor: Processor<T>,
  concurrency = 5,
): Worker<T> {
  const worker = new Worker<T>(name, processor, {
    // Workers also need their own connection
    connection: createBullConnection(),
    concurrency,
  });

  worker.on('completed', (job) =>
    log.info({ queue: name, jobId: job.id }, 'Job completed'),
  );
  worker.on('failed', (job, err) =>
    log.error({ queue: name, jobId: job?.id, err }, 'Job failed'),
  );

  workers.push(worker);
  return worker;
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
export async function closeQueues(): Promise<void> {
  await Promise.all([
    ...workers.map((w) => w.close()),
    ...Array.from(queues.values()).map((q) => q.close()),
  ]);
  log.info('All queues and workers closed');
}
