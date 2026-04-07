// src/server.ts
import 'dotenv/config';
import { createApp }                                  from './app';
import { config }                                     from '@shared/config';
import { connectDatabase, disconnectDatabase }        from '@infrastructure/database/prisma.client';
import { connectRedis, disconnectRedis }              from '@infrastructure/redis/redis.client';
import { closeQueues }                                from '@infrastructure/queue';
import { startWorkers }                               from './workers';
import { registerEventHandlers }                      from './event-handlers';
import { createLogger }                               from '@infrastructure/logger';
import type { Server }                                from 'http';

const log = createLogger('Server');

async function bootstrap(): Promise<void> {
  // ── 1. Database ────────────────────────────────────────────────────────────
  await connectDatabase();

  // ── 2. Redis ───────────────────────────────────────────────────────────────
  // connectRedis() waits for the 'ready' event — safe to use cache after this
  await connectRedis();

  // ── 3. Domain event handlers ───────────────────────────────────────────────
  registerEventHandlers();

  // ── 4. Background workers ──────────────────────────────────────────────────
  startWorkers();

  // ── 5. HTTP server ─────────────────────────────────────────────────────────
  const app    = createApp();
  const server: Server = app.listen(config.PORT, () => {
    log.info(
      { port: config.PORT, env: config.NODE_ENV },
      `🚀  ${config.APP_NAME} running — http://localhost:${config.PORT}`,
    );
    log.info(`📚  API Docs — http://localhost:${config.PORT}/api-docs`);
  });

  // ── 6. Graceful shutdown ───────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, 'Shutdown signal — draining connections...');

    server.close(async () => {
      try {
        await Promise.allSettled([
          disconnectDatabase(),
          disconnectRedis(),
          closeQueues(),
        ]);
        log.info('Graceful shutdown complete');
        process.exit(0);
      } catch (err) {
        log.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    });

    setTimeout(() => {
      log.error('Forced shutdown after 30s timeout');
      process.exit(1);
    }, 30_000);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    log.error({ reason }, 'Unhandled promise rejection');
  });

  process.on('uncaughtException', (err) => {
    log.fatal({ err }, 'Uncaught exception — shutting down');
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
