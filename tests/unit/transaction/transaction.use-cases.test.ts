// tests/unit/transaction/transaction.use-cases.test.ts
import {
  CreateTransactionUseCase,
  GetTransactionUseCase,
  DeleteTransactionUseCase,
} from '@services/transaction/application/use-cases/transaction.use-cases';
import type { ITransactionRepository } from '@services/transaction/domain/repositories/transaction.repository';
import { Transaction } from '@services/transaction/domain/entities/transaction.entity';
import { AppError } from '@shared/errors/AppError';
import { Prisma } from '@prisma/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeTx(overrides = {}): Transaction {
  return new Transaction({
    id:          'tx-001',
    userId:      'user-abc',
    amount:      new Prisma.Decimal('250.00'),
    type:        'EXPENSE',
    category:    'FOOD',
    description: 'Grocery shopping',
    tags:        ['grocery'],
    occurredAt:  new Date('2024-03-15'),
    createdAt:   new Date(),
    updatedAt:   new Date(),
    isDeleted:   false,
    ...overrides,
  });
}

function makeRepo(overrides: Partial<ITransactionRepository> = {}): ITransactionRepository {
  return {
    findById:   jest.fn().mockResolvedValue(makeTx()),
    findMany:   jest.fn().mockResolvedValue({ data: [makeTx()], pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false } }),
    create:     jest.fn().mockResolvedValue(makeTx()),
    update:     jest.fn().mockResolvedValue(makeTx()),
    softDelete: jest.fn().mockResolvedValue(undefined),
    sumByType:  jest.fn().mockResolvedValue({ totalIncome: 0, totalExpense: 0 }),
    ...overrides,
  };
}

// ─── Create ───────────────────────────────────────────────────────────────────
describe('CreateTransactionUseCase', () => {
  const dto = {
    amount:     250,
    type:       'EXPENSE' as const,
    category:   'FOOD' as const,
    description:'Lunch',
    tags:       [],
    occurredAt: new Date(),
  };

  it('creates a transaction and returns it', async () => {
    const repo    = makeRepo();
    const useCase = new CreateTransactionUseCase(repo);
    const result  = await useCase.execute('user-abc', dto);

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-abc',
      amount: 250,
      type:   'EXPENSE',
    }));
    expect(result.id).toBe('tx-001');
  });

  it('invalidates analytics cache after creation', async () => {
    const { cache } = await import('@infrastructure/redis/redis.client');
    const repo = makeRepo();
    await new CreateTransactionUseCase(repo).execute('user-abc', dto);

    expect(cache.del).toHaveBeenCalled();
    expect(cache.delPattern).toHaveBeenCalled();
  });

  it('publishes TRANSACTION_CREATED event', async () => {
    const { eventBus, Events } = await import('@infrastructure/events/eventBus');
    const repo = makeRepo();
    await new CreateTransactionUseCase(repo).execute('user-abc', dto);

    expect(eventBus.publish).toHaveBeenCalledWith(
      Events.TRANSACTION_CREATED,
      expect.objectContaining({ userId: 'user-abc' }),
    );
  });
});

// ─── Get ──────────────────────────────────────────────────────────────────────
describe('GetTransactionUseCase', () => {
  it('returns a transaction when found', async () => {
    const repo   = makeRepo();
    const result = await new GetTransactionUseCase(repo).execute('tx-001', 'user-abc');
    expect(result.id).toBe('tx-001');
  });

  it('throws NOT_FOUND when transaction does not exist', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    await expect(new GetTransactionUseCase(repo).execute('tx-999', 'user-abc'))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── Delete ───────────────────────────────────────────────────────────────────
describe('DeleteTransactionUseCase', () => {
  it('soft-deletes a transaction', async () => {
    const repo = makeRepo();
    await new DeleteTransactionUseCase(repo).execute('tx-001', 'user-abc');
    expect(repo.softDelete).toHaveBeenCalledWith('tx-001', 'user-abc');
  });

  it('publishes TRANSACTION_DELETED event', async () => {
    const { eventBus, Events } = await import('@infrastructure/events/eventBus');
    const repo = makeRepo();
    await new DeleteTransactionUseCase(repo).execute('tx-001', 'user-abc');

    expect(eventBus.publish).toHaveBeenCalledWith(
      Events.TRANSACTION_DELETED,
      expect.objectContaining({ transactionId: 'tx-001' }),
    );
  });
});
