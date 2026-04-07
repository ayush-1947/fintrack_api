// src/services/analytics/infrastructure/repositories/analytics.prisma.repository.ts
import { Prisma, Transaction } from '@prisma/client';
import { prisma } from '@infrastructure/database/prisma.client';

export interface OverviewStats {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  transactionCount: number;
}

export interface MonthlyTrend {
  year: number;
  month: number;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  count: number;
}

export interface CategoryBreakdown {
  category: string;
  total: number;
  count: number;
  percent: number;
}

export interface RecentActivity {
  id: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  description: string | null;
  occurredAt: Date;
}

export interface IAnalyticsRepository {
  getOverview(userId: string, dateFrom?: Date, dateTo?: Date): Promise<OverviewStats>;
  getMonthlyTrends(userId: string, year: number): Promise<MonthlyTrend[]>;
  getCategoryBreakdown(
    userId: string,
    type: 'INCOME' | 'EXPENSE',
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<CategoryBreakdown[]>;
  getRecentActivity(userId: string, limit: number): Promise<RecentActivity[]>;
}

// Raw types for Prisma queries
type RawMonthRow = {
  year: number;
  month: number;
  type: 'INCOME' | 'EXPENSE';
  total: Prisma.Decimal;
  count: bigint;
};

export class AnalyticsPrismaRepository implements IAnalyticsRepository {
  // ─── Overview ─────────────────────────────
  async getOverview(userId: string, dateFrom?: Date, dateTo?: Date): Promise<OverviewStats> {
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

    const grouped = await prisma.transaction.groupBy({
      by: ['type'] as const,
      where,
      _sum: { amount: true },
      _count: { id: true },
    });

    let totalIncome = 0;
    let totalExpense = 0;
    let transactionCount = 0;

    for (const row of grouped) {
      const amount = Number(row._sum.amount ?? 0);
      if (row.type === 'INCOME') totalIncome = amount;
      if (row.type === 'EXPENSE') totalExpense = amount;
      transactionCount += row._count.id;
    }

    return {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      transactionCount,
    };
  }

  // ─── Monthly Trends ──────────────────────
  async getMonthlyTrends(userId: string, year: number): Promise<MonthlyTrend[]> {
    const rows = await prisma.$queryRaw<RawMonthRow[]>`
      SELECT
        EXTRACT(YEAR FROM occurred_at)::int AS year,
        EXTRACT(MONTH FROM occurred_at)::int AS month,
        type,
        SUM(amount) AS total,
        COUNT(*) AS count
      FROM transactions
      WHERE user_id = ${userId}
        AND is_deleted = false
        AND EXTRACT(YEAR FROM occurred_at) = ${year}
      GROUP BY year, month, type
      ORDER BY year ASC, month ASC
    `;

    const monthMap = new Map<number, MonthlyTrend>();
    for (let m = 1; m <= 12; m++) {
      monthMap.set(m, { year, month: m, totalIncome: 0, totalExpense: 0, netBalance: 0, count: 0 });
    }

    for (const row of rows) {
      const m = row.month;
      const slot = monthMap.get(m)!;
      const amount = Number(row.total);
      const count = Number(row.count);

      if (row.type === 'INCOME') {
        slot.totalIncome = amount;
        slot.count += count;
      } else if (row.type === 'EXPENSE') {
        slot.totalExpense = amount;
        slot.count += count;
      }
      slot.netBalance = slot.totalIncome - slot.totalExpense;
    }

    return Array.from(monthMap.values());
  }

  // ─── Category Breakdown ─────────────────
  async getCategoryBreakdown(
    userId: string,
    type: 'INCOME' | 'EXPENSE',
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<CategoryBreakdown[]> {
    const where: Prisma.TransactionWhereInput = {
      userId,
      type,
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

    const grouped = await prisma.transaction.groupBy({
      by: ['category'] as const,
      where,
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    const grandTotal = grouped.reduce((sum, row) => sum + Number(row._sum.amount ?? 0), 0);

    return grouped.map((row) => {
      const total = Number(row._sum.amount ?? 0);
      return {
        category: row.category,
        total,
        count: row._count.id,
        percent: grandTotal > 0 ? Math.round((total / grandTotal) * 10000) / 100 : 0,
      };
    });
  }

  // ─── Recent Activity ────────────────────
  async getRecentActivity(userId: string, limit: number): Promise<RecentActivity[]> {
    const rows = await prisma.transaction.findMany({
      where: { userId, isDeleted: false },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(limit, 50),
      select: { id: true, amount: true, type: true, category: true, description: true, occurredAt: true },
    });

    return rows.map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      type: r.type,
      category: r.category,
      description: r.description,
      occurredAt: r.occurredAt,
    }));
  }
}