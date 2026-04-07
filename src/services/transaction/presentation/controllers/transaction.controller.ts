// src/services/transaction/presentation/controllers/transaction.controller.ts
import type { Request, Response, NextFunction } from 'express';
import { fromZodError } from 'zod-validation-error';
import { AppError } from '@shared/errors/AppError';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  TransactionQueryDto,
} from '../../application/dtos/transaction.dto';
import {
  CreateTransactionUseCase,
  GetTransactionUseCase,
  ListTransactionsUseCase,
  UpdateTransactionUseCase,
  DeleteTransactionUseCase,
} from '../../application/use-cases/transaction.use-cases';
import { TransactionPrismaRepository } from '../../infrastructure/repositories/transaction.prisma.repository';

// ─── Wiring ───────────────────────────────────────────────────────────────────
const repo = new TransactionPrismaRepository();
const createUseCase = new CreateTransactionUseCase(repo);
const getUseCase    = new GetTransactionUseCase(repo);
const listUseCase   = new ListTransactionsUseCase(repo);
const updateUseCase = new UpdateTransactionUseCase(repo);
const deleteUseCase = new DeleteTransactionUseCase(repo);

// ─── Controller ───────────────────────────────────────────────────────────────
export class TransactionController {
  // POST /transactions
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = CreateTransactionDto.safeParse(req.body);
      if (!parsed.success) {
        throw AppError.validationError(
          fromZodError(parsed.error).message,
          parsed.error.flatten().fieldErrors,
        );
      }
      const tx = await createUseCase.execute(req.auth!.userId, parsed.data);
      res.status(201).json({ success: true, data: tx });
    } catch (err) { next(err); }
  }

  // GET /transactions/:id
  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tx = await getUseCase.execute(req.params.id, req.auth!.userId);
      res.status(200).json({ success: true, data: tx });
    } catch (err) { next(err); }
  }

  // GET /transactions
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = TransactionQueryDto.safeParse(req.query);
      if (!parsed.success) {
        throw AppError.validationError(fromZodError(parsed.error).message);
      }
      const result = await listUseCase.execute(req.auth!.userId, parsed.data);
      res.status(200).json({ success: true, ...result });
    } catch (err) { next(err); }
  }

  // PATCH /transactions/:id
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = UpdateTransactionDto.safeParse(req.body);
      if (!parsed.success) {
        throw AppError.validationError(
          fromZodError(parsed.error).message,
          parsed.error.flatten().fieldErrors,
        );
      }
      const tx = await updateUseCase.execute(req.params.id, req.auth!.userId, parsed.data);
      res.status(200).json({ success: true, data: tx });
    } catch (err) { next(err); }
  }

  // DELETE /transactions/:id
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await deleteUseCase.execute(req.params.id, req.auth!.userId);
      res.status(200).json({ success: true, message: 'Transaction deleted successfully' });
    } catch (err) { next(err); }
  }
}

export const transactionController = new TransactionController();
