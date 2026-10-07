import { BudgetPeriod } from '../budget-period';

export type BudgetProps = {
  id: string;
  userId: string;
  categoryId: string;
  accountId: string;
  /** Spending limit per period, positive decimal string */
  amount: string;
  period: BudgetPeriod;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string };
  /** The budget's currency is the wallet's. */
  account: { id: string; name: string; currencyCode: string; decimalPlaces: number };
};

export class Budget {
  readonly id: string;
  readonly userId: string;
  readonly categoryId: string;
  readonly accountId: string;
  readonly amount: string;
  readonly period: BudgetPeriod;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly category: BudgetProps['category'];
  readonly account: BudgetProps['account'];

  constructor(props: BudgetProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.categoryId = props.categoryId;
    this.accountId = props.accountId;
    this.amount = props.amount;
    this.period = props.period;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.category = props.category;
    this.account = props.account;
  }

  get currencyCode(): string {
    return this.account.currencyCode;
  }
}

/** Spending in the budget's current period (completed expenses only). */
export type BudgetUsage = {
  spent: string;
  periodStart: Date;
  /** Exclusive */
  periodEnd: Date;
};
