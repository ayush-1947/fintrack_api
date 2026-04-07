// src/services/analytics/presentation/controllers/analytics.controller.ts
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { AppError } from '@shared/errors/AppError';
import { AnalyticsPrismaRepository } from '../../infrastructure/repositories/analytics.prisma.repository';
import {
  GetOverviewUseCase,
  GetMonthlyTrendsUseCase,
  GetCategoryBreakdownUseCase,
  GetRecentActivityUseCase,
} from '../../application/use-cases/analytics.use-cases';

// ─── Wiring ───────────────────────────────────────────────────────────────────
const repo                = new AnalyticsPrismaRepository();
const overviewUseCase     = new GetOverviewUseCase(repo);
const monthlyUseCase      = new GetMonthlyTrendsUseCase(repo);
const categoryUseCase     = new GetCategoryBreakdownUseCase(repo);
const recentUseCase       = new GetRecentActivityUseCase(repo);

// ─── Query Schemas ────────────────────────────────────────────────────────────
const DateRangeQuery = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo:   z.coerce.date().optional(),
});

const YearQuery = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()),
});

const CategoryQuery = z.object({
  type:     z.enum(['INCOME', 'EXPENSE']).default('EXPENSE'),
  dateFrom: z.coerce.date().optional(),
  dateTo:   z.coerce.date().optional(),
});

const RecentQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// ─── Controller ───────────────────────────────────────────────────────────────
export class AnalyticsController {
  // GET /analytics/overview
  async overview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = DateRangeQuery.safeParse(req.query);
      if (!parsed.success) throw AppError.validationError(fromZodError(parsed.error).message);

      const data = await overviewUseCase.execute(
        req.auth!.userId,
        parsed.data.dateFrom,
        parsed.data.dateTo,
      );
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  }

  // GET /analytics/trends?year=2024
  async monthlyTrends(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = YearQuery.safeParse(req.query);
      if (!parsed.success) throw AppError.validationError(fromZodError(parsed.error).message);

      const data = await monthlyUseCase.execute(req.auth!.userId, parsed.data.year);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  }

  // GET /analytics/categories
  async categoryBreakdown(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = CategoryQuery.safeParse(req.query);
      if (!parsed.success) throw AppError.validationError(fromZodError(parsed.error).message);

      const data = await categoryUseCase.execute(
        req.auth!.userId,
        parsed.data.type,
        parsed.data.dateFrom,
        parsed.data.dateTo,
      );
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  }

  // GET /analytics/recent
  async recentActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = RecentQuery.safeParse(req.query);
      if (!parsed.success) throw AppError.validationError(fromZodError(parsed.error).message);

      const data = await recentUseCase.execute(req.auth!.userId, parsed.data.limit);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  }
}

export const analyticsController = new AnalyticsController();
