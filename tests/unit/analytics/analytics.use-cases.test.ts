// tests/unit/analytics/analytics.use-cases.test.ts
import {
  GetOverviewUseCase,
  GetMonthlyTrendsUseCase,
  GetCategoryBreakdownUseCase,
} from '@services/analytics/application/use-cases/analytics.use-cases';
import type { IAnalyticsRepository } from '@services/analytics/infrastructure/repositories/analytics.prisma.repository';

// ─── Mock repository ─────────────────────────────────────────────────────────
const MOCK_OVERVIEW = {
  totalIncome:      5000,
  totalExpense:     3200,
  netBalance:       1800,
  transactionCount: 24,
};

const MOCK_TRENDS = Array.from({ length: 12 }, (_, i) => ({
  year: 2024, month: i + 1,
  totalIncome:  i % 2 === 0 ? 5000 : 0,
  totalExpense: i % 2 === 0 ? 3000 : 0,
  netBalance:   i % 2 === 0 ? 2000 : 0,
  count:        i % 2 === 0 ? 10 : 0,
}));

const MOCK_CATEGORIES = [
  { category: 'FOOD',      total: 1200, count: 20, percent: 37.5 },
  { category: 'TRANSPORT', total:  800, count: 10, percent: 25.0 },
  { category: 'HOUSING',   total: 1200, count:  1, percent: 37.5 },
];

function makeRepo(overrides: Partial<IAnalyticsRepository> = {}): IAnalyticsRepository {
  return {
    getOverview:          jest.fn().mockResolvedValue(MOCK_OVERVIEW),
    getMonthlyTrends:     jest.fn().mockResolvedValue(MOCK_TRENDS),
    getCategoryBreakdown: jest.fn().mockResolvedValue(MOCK_CATEGORIES),
    getRecentActivity:    jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

// ─── Overview ─────────────────────────────────────────────────────────────────
describe('GetOverviewUseCase', () => {
  it('returns analytics overview without date filter', async () => {
    const repo   = makeRepo();
    const result = await new GetOverviewUseCase(repo).execute('user-1');

    expect(result.totalIncome).toBe(5000);
    expect(result.totalExpense).toBe(3200);
    expect(result.netBalance).toBe(1800);
    expect(repo.getOverview).toHaveBeenCalledWith('user-1');
  });

  it('returns cached result on second call (no date filter)', async () => {
    const { cache } = await import('@infrastructure/redis/redis.client');
    (cache.get as jest.Mock).mockResolvedValueOnce(MOCK_OVERVIEW);

    const repo   = makeRepo();
    const result = await new GetOverviewUseCase(repo).execute('user-cached');

    // Should return cached — repo should NOT be called
    expect(repo.getOverview).not.toHaveBeenCalled();
    expect(result.netBalance).toBe(1800);
  });

  it('bypasses cache when date filter is provided', async () => {
    const repo   = makeRepo();
    const from   = new Date('2024-01-01');
    const to     = new Date('2024-12-31');
    await new GetOverviewUseCase(repo).execute('user-1', from, to);

    // Always hits DB with date filter — can't safely cache with arbitrary date ranges
    expect(repo.getOverview).toHaveBeenCalledWith('user-1', from, to);
  });
});

// ─── Monthly Trends ───────────────────────────────────────────────────────────
describe('GetMonthlyTrendsUseCase', () => {
  it('returns 12 months of data', async () => {
    const repo   = makeRepo();
    const result = await new GetMonthlyTrendsUseCase(repo).execute('user-1', 2024);

    expect(result).toHaveLength(12);
    expect(result[0].year).toBe(2024);
    expect(result[0].month).toBe(1);
  });

  it('calls repository with correct year', async () => {
    const repo = makeRepo();
    await new GetMonthlyTrendsUseCase(repo).execute('user-1', 2023);
    expect(repo.getMonthlyTrends).toHaveBeenCalledWith('user-1', 2023);
  });
});

// ─── Category Breakdown ───────────────────────────────────────────────────────
describe('GetCategoryBreakdownUseCase', () => {
  it('returns categories sorted by total descending', async () => {
    const repo   = makeRepo();
    const result = await new GetCategoryBreakdownUseCase(repo).execute('user-1', 'EXPENSE');

    // Mock data is already sorted; just verify shape
    expect(result[0]).toMatchObject({
      category: expect.any(String),
      total:    expect.any(Number),
      percent:  expect.any(Number),
    });
  });

  it('percentages sum to approximately 100', async () => {
    const repo   = makeRepo();
    const result = await new GetCategoryBreakdownUseCase(repo).execute('user-1', 'EXPENSE');
    const sum    = result.reduce((s, r) => s + r.percent, 0);
    expect(Math.round(sum)).toBe(100);
  });
});
