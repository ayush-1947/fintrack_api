// src/services/transaction/infrastructure/repositories/transaction.prisma.repository.ts
import { Prisma } from '@prisma/client';
import { prisma } from '@infrastructure/database/prisma.client';
import { Transaction } from '../../domain/entities/transaction.entity';
import type {
  ITransactionRepository,
  TransactionFilters,
  CreateTransactionInput,
  UpdateTransactionInput,
} from '../../domain/repositories/transaction.repository';
import type { PaginatedResult, PaginationParams } from '@shared/types';
import { AppError } from '@shared/errors/AppError';
import type { TransactionType, TransactionCategory } from '../../domain/entities/transaction.entity';

type PrismaTransaction = {
  id: string;
  userId: string;
  amount: Prisma.Decimal;
  type: string;
  category: string;
  description: string | null;
  tags: string[];
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
};

// Convert Prisma row to Domain Entity
function toEntity(row: PrismaTransaction): Transaction {
  return new Transaction({
    id: row.id,
    userId: row.userId,
    amount: row.amount,
    type: row.type as TransactionType,
    category: row.category as TransactionCategory,
    description: row.description,
    tags: row.tags,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isDeleted: row.isDeleted,
  });
}

// Allowed sortable fields for findMany
const SORTABLE_FIELDS = new Set(['occurredAt', 'amount', 'createdAt', 'category', 'type']);

export class TransactionPrismaRepository implements ITransactionRepository {
  // ─── Find by ID ────────────────────────
  async findById(id: string, userId: string): Promise<Transaction | null> {
    const row = await prisma.transaction.findFirst({
      where: { id, userId, isDeleted: false },
    });
    return row ? toEntity(row as PrismaTransaction) : null;
  }

  // ─── Find Many with Filters & Pagination ─
  async findMany(
    filters: TransactionFilters,
    pagination: PaginationParams,
    sort: { field: string; direction: 'asc' | 'desc' } = { field: 'occurredAt', direction: 'desc' }
  ): Promise<PaginatedResult<Transaction>> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;
    const sortField = SORTABLE_FIELDS.has(sort.field) ? sort.field : 'occurredAt';

    const where: Prisma.TransactionWhereInput = {
      userId: filters.userId,
      isDeleted: false,
      ...(filters.type && { type: filters.type }),
      ...(filters.category && { category: filters.category }),
      ...((filters.dateFrom ?? filters.dateTo) && {
        occurredAt: {
          ...(filters.dateFrom && { gte: filters.dateFrom }),
          ...(filters.dateTo && { lte: filters.dateTo }),
        },
      }),
      ...((filters.amountMin !== undefined || filters.amountMax !== undefined) && {
        amount: {
          ...(filters.amountMin !== undefined && { gte: new Prisma.Decimal(filters.amountMin) }),
          ...(filters.amountMax !== undefined && { lte: new Prisma.Decimal(filters.amountMax) }),
        },
      }),
      ...(filters.search && {
        description: { contains: filters.search, mode: Prisma.QueryMode.insensitive },
      }),
    };

    const [rows, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortField]: sort.direction },
      }),
      prisma.transaction.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: (rows as PrismaTransaction[]).map(toEntity),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  // ─── Create Transaction ─────────────────
  async create(input: CreateTransactionInput): Promise<Transaction> {
    const row = await prisma.transaction.create({
      data: {
        userId: input.userId,
        amount: new Prisma.Decimal(input.amount),
        type: input.type,
        category: input.category,
        description: input.description,
        tags: input.tags ?? [],
        occurredAt: input.occurredAt,
      },
    });
    return toEntity(row as PrismaTransaction);
  }

  // ─── Update Transaction ─────────────────
  async update(id: string, userId: string, input: UpdateTransactionInput): Promise<Transaction> {
    const existing = await this.findById(id, userId);
    if (!existing) throw AppError.notFound('Transaction', id);

    const row = await prisma.transaction.update({
      where: { id },
      data: {
        ...(input.amount !== undefined && { amount: new Prisma.Decimal(input.amount) }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.tags !== undefined && { tags: input.tags }),
        ...(input.occurredAt !== undefined && { occurredAt: input.occurredAt }),
      },
    });
    return toEntity(row as PrismaTransaction);
  }

  // ─── Soft Delete ───────────────────────
  async softDelete(id: string, userId: string): Promise<void> {
    const existing = await this.findById(id, userId);
    if (!existing) throw AppError.notFound('Transaction', id);
    await prisma.transaction.update({ where: { id }, data: { isDeleted: true } });
  }

  // ─── Sum by Type (INCOME/EXPENSE) ─────
  async sumByType(userId: string, dateFrom?: Date, dateTo?: Date): Promise<{ totalIncome: number; totalExpense: number }> {
    const where: Prisma.TransactionWhereInput = {
      userId,
      isDeleted: false,
      ...(dateFrom || dateTo
        ? {
            occurredAt: {
              ...(dateFrom && { gte: dateFrom }),
              ...(dateTo && { lte: dateTo }),
            },
          }
        : {}),
    };

    const result = await prisma.transaction.groupBy({
      by: ['type'] as const,
      where,
      _sum: { amount: true },
    });

    let totalIncome = 0;
    let totalExpense = 0;

    for (const row of result) {
      const val = Number(row._sum.amount ?? 0);
      if (row.type === 'INCOME') totalIncome = val;
      if (row.type === 'EXPENSE') totalExpense = val;
    }

    return { totalIncome, totalExpense };
  }
}