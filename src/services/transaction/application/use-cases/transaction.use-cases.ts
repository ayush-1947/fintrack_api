// src/services/transaction/application/use-cases/transaction.use-cases.ts
import { eventBus, Events } from '@infrastructure/events/eventBus';
import { cache, CacheKeys } from '@infrastructure/redis/redis.client';
import { createLogger } from '@infrastructure/logger';
import { AppError } from '@shared/errors/AppError';
import type { ITransactionRepository } from '../../domain/repositories/transaction.repository';
import type {
  CreateTransactionDto,
  UpdateTransactionDto,
  TransactionQueryDto,
} from '../dtos/transaction.dto';
import type { Transaction } from '../../domain/entities/transaction.entity';
import type { PaginatedResult } from '@shared/types';

const log = createLogger('TransactionUseCases');

// ─── Create Transaction ───────────────────────────────────────────────────────
export class CreateTransactionUseCase {
  constructor(private readonly repo: ITransactionRepository) {}

  async execute(userId: string, dto: CreateTransactionDto): Promise<Transaction> {
    const transaction = await this.repo.create({
      userId,
      amount:      dto.amount,
      type:        dto.type,
      category:    dto.category,
      description: dto.description,
      tags:        dto.tags,
      occurredAt:  dto.occurredAt,
    });

    // Invalidate analytics cache for this user — data has changed
    await cache.delPattern(`analytics:*:${userId}:*`);
    await cache.del(CacheKeys.analyticsOverview(userId));

    // Publish domain event for Analytics service to react
    eventBus.publish(Events.TRANSACTION_CREATED, {
      userId,
      transactionId: transaction.id,
      type:          transaction.type,
      amount:        transaction.amount.toNumber(),
      category:      transaction.category,
      occurredAt:    transaction.occurredAt,
    });

    log.info({ userId, transactionId: transaction.id }, 'Transaction created');
    return transaction;
  }
}

// ─── Get Transaction ──────────────────────────────────────────────────────────
export class GetTransactionUseCase {
  constructor(private readonly repo: ITransactionRepository) {}

  async execute(id: string, userId: string): Promise<Transaction> {
    const transaction = await this.repo.findById(id, userId);
    if (!transaction) throw AppError.notFound('Transaction', id);
    return transaction;
  }
}

// ─── List Transactions ────────────────────────────────────────────────────────
export class ListTransactionsUseCase {
  constructor(private readonly repo: ITransactionRepository) {}

  async execute(
    userId: string,
    query: TransactionQueryDto,
  ): Promise<PaginatedResult<Transaction>> {
    return this.repo.findMany(
      {
        userId,
        type:      query.type,
        category:  query.category,
        dateFrom:  query.dateFrom,
        dateTo:    query.dateTo,
        amountMin: query.amountMin,
        amountMax: query.amountMax,
        search:    query.search,
      },
      { page: query.page, limit: query.limit },
      { field: query.sortBy, direction: query.sortDir },
    );
  }
}

// ─── Update Transaction ───────────────────────────────────────────────────────
export class UpdateTransactionUseCase {
  constructor(private readonly repo: ITransactionRepository) {}

  async execute(id: string, userId: string, dto: UpdateTransactionDto): Promise<Transaction> {
    const transaction = await this.repo.update(id, userId, dto);

    await cache.del(CacheKeys.analyticsOverview(userId));
    await cache.delPattern(`analytics:*:${userId}:*`);

    eventBus.publish(Events.TRANSACTION_UPDATED, {
      userId,
      transactionId: transaction.id,
    });

    log.info({ userId, transactionId: id }, 'Transaction updated');
    return transaction;
  }
}

// ─── Delete Transaction ───────────────────────────────────────────────────────
export class DeleteTransactionUseCase {
  constructor(private readonly repo: ITransactionRepository) {}

  async execute(id: string, userId: string): Promise<void> {
    await this.repo.softDelete(id, userId);

    await cache.del(CacheKeys.analyticsOverview(userId));
    await cache.delPattern(`analytics:*:${userId}:*`);

    eventBus.publish(Events.TRANSACTION_DELETED, { userId, transactionId: id });

    log.info({ userId, transactionId: id }, 'Transaction soft-deleted');
  }
}
