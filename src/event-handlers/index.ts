// src/event-handlers/index.ts
//
// This module wires domain events to their downstream consumers.
// In a microservices deployment, each consumer runs in its own process
// and listens on Kafka/RabbitMQ. The interface here is identical —
// only the transport changes.

import { eventBus, Events }   from '@infrastructure/events/eventBus';
import { getQueue, QUEUES }   from '@infrastructure/queue';
import type { AnalyticsJobData, AuditJobData } from '@infrastructure/queue';
import { createLogger }       from '@infrastructure/logger';

const log = createLogger('EventHandlers');

export function registerEventHandlers(): void {

  // ── Transaction Created → enqueue analytics recompute ─────────────────────
  eventBus.subscribe<{
    userId: string; transactionId: string; occurredAt: Date;
  }>(Events.TRANSACTION_CREATED, async (event) => {
    const { userId, occurredAt } = event.payload;
    const date  = new Date(occurredAt);
    const year  = date.getFullYear();
    const month = date.getMonth() + 1;

    await getQueue<AnalyticsJobData>(QUEUES.ANALYTICS).add(
      'recompute-snapshot',
      { type: 'RECOMPUTE_MONTHLY_SNAPSHOT', userId, year, month },
      { jobId: `snapshot:${userId}:${year}-${month}`, removeOnComplete: true },
      // jobId deduplicates: concurrent transactions in the same month
      // won't spawn duplicate snapshot jobs
    );

    await getQueue<AuditJobData>(QUEUES.AUDIT).add('audit', {
      userId,
      action:     'CREATE',
      resource:   'TRANSACTION',
      resourceId: event.payload.transactionId,
    });
  });

  // ── Transaction Updated / Deleted → same recompute ────────────────────────
  eventBus.subscribe<{ userId: string; transactionId: string }>(
    Events.TRANSACTION_UPDATED,
    async (event) => {
      await getQueue<AuditJobData>(QUEUES.AUDIT).add('audit', {
        userId:     event.payload.userId,
        action:     'UPDATE',
        resource:   'TRANSACTION',
        resourceId: event.payload.transactionId,
      });
    },
  );

  eventBus.subscribe<{ userId: string; transactionId: string }>(
    Events.TRANSACTION_DELETED,
    async (event) => {
      await getQueue<AuditJobData>(QUEUES.AUDIT).add('audit', {
        userId:     event.payload.userId,
        action:     'DELETE',
        resource:   'TRANSACTION',
        resourceId: event.payload.transactionId,
      });
    },
  );

  // ── User Registered → audit ────────────────────────────────────────────────
  eventBus.subscribe<{ userId: string; email: string }>(
    Events.USER_REGISTERED,
    async (event) => {
      await getQueue<AuditJobData>(QUEUES.AUDIT).add('audit', {
        userId:   event.payload.userId,
        action:   'REGISTER',
        resource: 'USER',
        resourceId: event.payload.userId,
      });
    },
  );

  // ── User Logged In → audit ────────────────────────────────────────────────
  eventBus.subscribe<{ userId: string; ip?: string }>(
    Events.USER_LOGGED_IN,
    async (event) => {
      await getQueue<AuditJobData>(QUEUES.AUDIT).add('audit', {
        userId:    event.payload.userId,
        action:    'LOGIN',
        resource:  'USER',
        ipAddress: event.payload.ip,
      });
    },
  );

  log.info('All domain event handlers registered');
}
