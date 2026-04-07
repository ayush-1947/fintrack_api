// src/services/transaction/domain/entities/transaction.entity.ts
import type { Decimal } from '@prisma/client/runtime/library';

export type TransactionType     = 'INCOME' | 'EXPENSE';
export type TransactionCategory =
  | 'SALARY' | 'FREELANCE' | 'INVESTMENT' | 'GIFT' | 'REFUND'
  | 'FOOD' | 'TRANSPORT' | 'HOUSING' | 'HEALTH' | 'EDUCATION'
  | 'ENTERTAINMENT' | 'SHOPPING' | 'UTILITIES' | 'INSURANCE' | 'TAXES' | 'OTHER';

export interface TransactionProps {
  id:          string;
  userId:      string;
  amount:      Decimal;
  type:        TransactionType;
  category:    TransactionCategory;
  description: string | null;
  tags:        string[];
  occurredAt:  Date;
  createdAt:   Date;
  updatedAt:   Date;
  isDeleted:   boolean;
}

export class Transaction {
  readonly id!:          string;
  readonly userId!:      string;
  readonly amount!:      Decimal;
  readonly type!:        TransactionType;
  readonly category!:    TransactionCategory;
  readonly description!: string | null;
  readonly tags!:        string[];
  readonly occurredAt!:  Date;
  readonly createdAt!:   Date;
  readonly updatedAt!:   Date;
  readonly isDeleted!:   boolean;

  constructor(props: TransactionProps) {
    Object.assign(this, props);
  }

  isIncome():  boolean { return this.type === 'INCOME'; }
  isExpense(): boolean { return this.type === 'EXPENSE'; }

  toJSON() {
    return {
      id:          this.id,
      userId:      this.userId,
      amount:      this.amount.toFixed(2),
      type:        this.type,
      category:    this.category,
      description: this.description,
      tags:        this.tags,
      occurredAt:  this.occurredAt,
      createdAt:   this.createdAt,
      updatedAt:   this.updatedAt,
    };
  }
}
