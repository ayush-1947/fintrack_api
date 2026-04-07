// src/services/transaction/domain/repositories/transaction.repository.ts
import type { Transaction, TransactionType, TransactionCategory } from '../entities/transaction.entity';
import type { PaginatedResult, PaginationParams } from '@shared/types';

export interface TransactionFilters {
  userId:       string;
  type?:        TransactionType;
  category?:    TransactionCategory;
  dateFrom?:    Date;
  dateTo?:      Date;
  amountMin?:   number;
  amountMax?:   number;
  search?:      string;
}

export interface CreateTransactionInput {
  userId:      string;
  amount:      number;
  type:        TransactionType;
  category:    TransactionCategory;
  description?: string;
  tags?:       string[];
  occurredAt:  Date;
}

export interface UpdateTransactionInput {
  amount?:      number;
  type?:        TransactionType;
  category?:    TransactionCategory;
  description?: string;
  tags?:        string[];
  occurredAt?:  Date;
}

export interface ITransactionRepository {
  findById(id: string, userId: string): Promise<Transaction | null>;
  findMany(
    filters: TransactionFilters,
    pagination: PaginationParams,
    sort?: { field: string; direction: 'asc' | 'desc' },
  ): Promise<PaginatedResult<Transaction>>;
  create(input: CreateTransactionInput): Promise<Transaction>;
  update(id: string, userId: string, input: UpdateTransactionInput): Promise<Transaction>;
  softDelete(id: string, userId: string): Promise<void>;
  sumByType(userId: string, dateFrom?: Date, dateTo?: Date): Promise<{
    totalIncome:  number;
    totalExpense: number;
  }>;
}
