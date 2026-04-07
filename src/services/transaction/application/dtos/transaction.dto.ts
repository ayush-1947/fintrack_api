// src/services/transaction/application/dtos/transaction.dto.ts
import { z } from 'zod';

const TRANSACTION_TYPES     = ['INCOME', 'EXPENSE'] as const;
const TRANSACTION_CATEGORIES = [
  'SALARY', 'FREELANCE', 'INVESTMENT', 'GIFT', 'REFUND',
  'FOOD', 'TRANSPORT', 'HOUSING', 'HEALTH', 'EDUCATION',
  'ENTERTAINMENT', 'SHOPPING', 'UTILITIES', 'INSURANCE', 'TAXES', 'OTHER',
] as const;

// ─── Create ───────────────────────────────────────────────────────────────────
export const CreateTransactionDto = z.object({
  amount:      z.number().positive('Amount must be positive').multipleOf(0.01),
  type:        z.enum(TRANSACTION_TYPES),
  category:    z.enum(TRANSACTION_CATEGORIES),
  description: z.string().max(500).optional(),
  tags:        z.array(z.string().max(30)).max(10).optional().default([]),
  occurredAt:  z.coerce.date(),
});
export type CreateTransactionDto = z.infer<typeof CreateTransactionDto>;

// ─── Update ───────────────────────────────────────────────────────────────────
export const UpdateTransactionDto = z.object({
  amount:      z.number().positive().multipleOf(0.01).optional(),
  type:        z.enum(TRANSACTION_TYPES).optional(),
  category:    z.enum(TRANSACTION_CATEGORIES).optional(),
  description: z.string().max(500).optional(),
  tags:        z.array(z.string().max(30)).max(10).optional(),
  occurredAt:  z.coerce.date().optional(),
}).refine((obj) => Object.keys(obj).length > 0, { message: 'At least one field must be provided' });
export type UpdateTransactionDto = z.infer<typeof UpdateTransactionDto>;

// ─── Query / Filter ───────────────────────────────────────────────────────────
export const TransactionQueryDto = z.object({
  // Filters
  type:      z.enum(TRANSACTION_TYPES).optional(),
  category:  z.enum(TRANSACTION_CATEGORIES).optional(),
  dateFrom:  z.coerce.date().optional(),
  dateTo:    z.coerce.date().optional(),
  amountMin: z.coerce.number().nonnegative().optional(),
  amountMax: z.coerce.number().nonnegative().optional(),
  search:    z.string().max(100).optional(),
  // Pagination
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  // Sort
  sortBy:    z.enum(['occurredAt', 'amount', 'createdAt', 'category']).default('occurredAt'),
  sortDir:   z.enum(['asc', 'desc']).default('desc'),
}).refine(
  (d) => !(d.dateFrom && d.dateTo && d.dateFrom > d.dateTo),
  { message: 'dateFrom must be before dateTo', path: ['dateFrom'] },
).refine(
  (d) => !(d.amountMin !== undefined && d.amountMax !== undefined && d.amountMin > d.amountMax),
  { message: 'amountMin must be <= amountMax', path: ['amountMin'] },
);
export type TransactionQueryDto = z.infer<typeof TransactionQueryDto>;
