// tests/unit/transaction/transaction.dto.test.ts
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  TransactionQueryDto,
} from '@services/transaction/application/dtos/transaction.dto';

describe('CreateTransactionDto', () => {
  const valid = {
    amount:     500.50,
    type:       'EXPENSE',
    category:   'FOOD',
    occurredAt: '2024-03-15T12:00:00.000Z',
  };

  it('parses a valid payload', () => {
    const result = CreateTransactionDto.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects negative amount', () => {
    const r = CreateTransactionDto.safeParse({ ...valid, amount: -10 });
    expect(r.success).toBe(false);
  });

  it('rejects zero amount', () => {
    const r = CreateTransactionDto.safeParse({ ...valid, amount: 0 });
    expect(r.success).toBe(false);
  });

  it('rejects invalid type', () => {
    const r = CreateTransactionDto.safeParse({ ...valid, type: 'TRANSFER' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid category', () => {
    const r = CreateTransactionDto.safeParse({ ...valid, category: 'UNKNOWN' });
    expect(r.success).toBe(false);
  });

  it('rejects more than 10 tags', () => {
    const r = CreateTransactionDto.safeParse({
      ...valid,
      tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
    });
    expect(r.success).toBe(false);
  });

  it('defaults tags to empty array', () => {
    const r = CreateTransactionDto.safeParse(valid);
    expect(r.success && r.data.tags).toEqual([]);
  });

  it('coerces occurredAt string to Date', () => {
    const r = CreateTransactionDto.safeParse(valid);
    expect(r.success && r.data.occurredAt).toBeInstanceOf(Date);
  });
});

describe('TransactionQueryDto', () => {
  it('applies defaults for pagination', () => {
    const r = TransactionQueryDto.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.limit).toBe(20);
      expect(r.data.sortBy).toBe('occurredAt');
      expect(r.data.sortDir).toBe('desc');
    }
  });

  it('rejects dateFrom > dateTo', () => {
    const r = TransactionQueryDto.safeParse({
      dateFrom: '2024-12-31',
      dateTo:   '2024-01-01',
    });
    expect(r.success).toBe(false);
  });

  it('rejects amountMin > amountMax', () => {
    const r = TransactionQueryDto.safeParse({ amountMin: 1000, amountMax: 100 });
    expect(r.success).toBe(false);
  });

  it('rejects limit > 100', () => {
    const r = TransactionQueryDto.safeParse({ limit: 200 });
    expect(r.success).toBe(false);
  });
});

describe('UpdateTransactionDto', () => {
  it('requires at least one field', () => {
    const r = UpdateTransactionDto.safeParse({});
    expect(r.success).toBe(false);
  });

  it('accepts partial updates', () => {
    const r = UpdateTransactionDto.safeParse({ amount: 999 });
    expect(r.success).toBe(true);
  });

  it('accepts description update only', () => {
    const r = UpdateTransactionDto.safeParse({ description: 'Updated' });
    expect(r.success).toBe(true);
  });
});
