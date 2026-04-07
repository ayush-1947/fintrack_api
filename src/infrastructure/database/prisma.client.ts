// src/infrastructure/database/prisma.client.ts
import { PrismaClient } from '@prisma/client';
import { createLogger } from '@infrastructure/logger';

const log = createLogger('PrismaClient');

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function buildPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).$on('query', (e: { query: string; duration: number }) => {
    if (e.duration > 500) {
      log.warn({ query: e.query, duration: e.duration }, 'Slow query detected');
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).$on('error', (e: { message: string }) => {
    log.error({ message: e.message }, 'Prisma error');
  });

  return client;
}

export const prisma: PrismaClient =
  process.env.NODE_ENV === 'test'
    ? buildPrismaClient()
    : (global.__prisma ??= buildPrismaClient());

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    log.info('Database connected');
  } catch (err) {
    log.error({ err }, 'Failed to connect to database');
    throw err;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  log.info('Database disconnected');
}
