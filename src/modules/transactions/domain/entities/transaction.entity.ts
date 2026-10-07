import { CategoryKind } from '@/modules/categories/domain/category-kind';
import { TransactionDirection, TransactionType, directionOf } from '../transaction-type';
import { TransactionStatus } from '../transaction-status';

export type TransactionAccountSummary = {
  id: string;
  name: string;
  currencyCode: string;
  decimalPlaces: number;
};

export type TransactionCategorySummary = {
  id: string;
  name: string;
  kind: CategoryKind;
};

export type TransactionProps = {
  id: string;
  reference: string;
  userId: string;
  accountId: string;
  categoryId: string;
  type: TransactionType;
  /** Positive decimal string as stored (e.g. `"42.5000"`) */
  amount: string;
  status: TransactionStatus;
  counterparty: string | null;
  narration: string | null;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
  account: TransactionAccountSummary;
  category: TransactionCategorySummary;
};

export class Transaction {
  readonly id: string;
  readonly reference: string;
  readonly userId: string;
  readonly accountId: string;
  readonly categoryId: string;
  readonly type: TransactionType;
  readonly amount: string;
  readonly status: TransactionStatus;
  readonly counterparty: string | null;
  readonly narration: string | null;
  readonly occurredAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly account: TransactionAccountSummary;
  readonly category: TransactionCategorySummary;

  constructor(props: TransactionProps) {
    this.id = props.id;
    this.reference = props.reference;
    this.userId = props.userId;
    this.accountId = props.accountId;
    this.categoryId = props.categoryId;
    this.type = props.type;
    this.amount = props.amount;
    this.status = props.status;
    this.counterparty = props.counterparty;
    this.narration = props.narration;
    this.occurredAt = props.occurredAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.account = props.account;
    this.category = props.category;
  }

  /** `in` for income, `out` for expense. */
  get direction(): TransactionDirection {
    return directionOf(this.type);
  }

  /** Amount with its balance effect applied: income positive, expense negative. */
  get signedAmount(): string {
    return this.type === TransactionType.EXPENSE ? `-${this.amount}` : this.amount;
  }
}
