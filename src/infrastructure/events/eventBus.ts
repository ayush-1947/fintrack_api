// src/infrastructure/events/eventBus.ts
//
// Production note: Replace this in-process EventEmitter with a real message
// broker (Kafka / RabbitMQ) when extracting services. The interface stays the
// same — only the transport changes, which is exactly why we depend on the
// abstraction rather than the implementation.

import { EventEmitter } from 'events';
import { createLogger } from '@infrastructure/logger';
import type { DomainEvent } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const log = createLogger('EventBus');

// ─── Event Topics ─────────────────────────────────────────────────────────────
export const Events = {
  // Auth events
  USER_REGISTERED:      'user.registered',
  USER_LOGGED_IN:       'user.logged_in',
  USER_PASSWORD_RESET:  'user.password_reset',

  // Transaction events — picked up by Analytics service
  TRANSACTION_CREATED:  'transaction.created',
  TRANSACTION_UPDATED:  'transaction.updated',
  TRANSACTION_DELETED:  'transaction.deleted',
} as const;

export type EventTopic = (typeof Events)[keyof typeof Events];

type Handler<T = unknown> = (event: DomainEvent<T>) => Promise<void> | void;

// ─── EventBus ────────────────────────────────────────────────────────────────
class EventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  publish<T>(topic: EventTopic, payload: T, metadata?: Record<string, unknown>): void {
    const event: DomainEvent<T> = {
      eventId: uuidv4(),
      eventType: topic,
      occurredAt: new Date(),
      payload,
      metadata,
    };

    log.debug({ eventType: topic, eventId: event.eventId }, 'Publishing event');
    this.emitter.emit(topic, event);
  }

  subscribe<T>(topic: EventTopic, handler: Handler<T>): void {
    this.emitter.on(topic, async (event: DomainEvent<T>) => {
      try {
        await handler(event);
      } catch (err) {
        log.error({ eventType: topic, eventId: event.eventId, err }, 'Event handler error');
        // In production: dead-letter queue, retry logic, alerting
      }
    });
    log.debug({ topic }, 'Event handler registered');
  }

  unsubscribe(topic: EventTopic, handler: Handler): void {
    this.emitter.off(topic, handler);
  }
}

// Singleton
export const eventBus = new EventBus();
