// src/services/analytics/application/use-cases/analytics.use-cases.ts
import { cache, CacheKeys } from '@infrastructure/redis/redis.client';
import { createLogger } from '@infrastructure/logger';
import type { IAnalyticsRepository, OverviewStats, MonthlyTrend, CategoryBreakdown, RecentActivity } from '../../infrastructure/repositories/analytics.prisma.repository';

const log = createLogger('AnalyticsUseCases');

const CACHE_TTL = 300; // 5 minutes — analytics can be slightly stale

// ─── Get Overview ─────────────────────────────────────────────────────────────
export class GetOverviewUseCase {
  constructor(private readonly repo: IAnalyticsRepository) {}

  async execute(
    userId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<OverviewStats> {
    // Only cache unbounded overviews (no date filter) to keep cache simple
    if (!dateFrom && !dateTo) {
      const cacheKey = CacheKeys.analyticsOverview(userId);
      const cached   = await cache.get<OverviewStats>(cacheKey);
      if (cached) {
        log.debug({ userId }, 'Analytics overview cache hit');
        return cached;
      }

      const stats = await this.repo.getOverview(userId);
      await cache.set(cacheKey, stats, CACHE_TTL);
      return stats;
    }

    return this.repo.getOverview(userId, dateFrom, dateTo);
  }
}

// ─── Get Monthly Trends ───────────────────────────────────────────────────────
export class GetMonthlyTrendsUseCase {
  constructor(private readonly repo: IAnalyticsRepository) {}

  async execute(userId: string, year: number): Promise<MonthlyTrend[]> {
    const cacheKey = CacheKeys.analyticsMonthly(userId, year);
    const cached   = await cache.get<MonthlyTrend[]>(cacheKey);
    if (cached) return cached;

    const trends = await this.repo.getMonthlyTrends(userId, year);
    await cache.set(cacheKey, trends, CACHE_TTL);
    return trends;
  }
}

// ─── Get Category Breakdown ───────────────────────────────────────────────────
export class GetCategoryBreakdownUseCase {
  constructor(private readonly repo: IAnalyticsRepository) {}

  async execute(
    userId: string,
    type: 'INCOME' | 'EXPENSE',
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<CategoryBreakdown[]> {
    const period   = `${dateFrom?.toISOString() ?? 'all'}-${dateTo?.toISOString() ?? 'all'}-${type}`;
    const cacheKey = CacheKeys.analyticsCategory(userId, period);

    const cached = await cache.get<CategoryBreakdown[]>(cacheKey);
    if (cached) return cached;

    const breakdown = await this.repo.getCategoryBreakdown(userId, type, dateFrom, dateTo);
    await cache.set(cacheKey, breakdown, CACHE_TTL);
    return breakdown;
  }
}

// ─── Get Recent Activity ──────────────────────────────────────────────────────
export class GetRecentActivityUseCase {
  constructor(private readonly repo: IAnalyticsRepository) {}

  async execute(userId: string, limit = 10): Promise<RecentActivity[]> {
    return this.repo.getRecentActivity(userId, limit);
  }
}
