import { Transaction } from '../entities/transaction.entity';
import { TransactionStatus } from '../transaction-status';
import { TransactionType } from '../transaction-type';

export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');

/** Raised by `create` when the generated reference already exists (caller retries). */
export class DuplicateTransactionReferenceError extends Error {
  constructor(reference: string) {
    super(`Transaction reference already exists: ${reference}`);
    this.name = 'DuplicateTransactionReferenceError';
  }
}

export type CreateTransactionInput = {
  reference: string;
  userId: string;
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amount: string;
  status: TransactionStatus;
  counterparty: string | null;
  narration: string | null;
  occurredAt: Date;
};

export type UpdateTransactionInput = Partial<
  Pick<
    CreateTransactionInput,
    'accountId' | 'categoryId' | 'type' | 'amount' | 'counterparty' | 'narration' | 'occurredAt'
  >
>;

export const TRANSACTION_SORT_FIELDS = [
  'occurredAt',
  'amount',
  'createdAt',
  'reference',
  'counterparty',
] as const;
export type TransactionSortField = (typeof TRANSACTION_SORT_FIELDS)[number];
export type SortOrder = 'ASC' | 'DESC';

export type ListTransactionsQuery = {
  userId: string;
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  /** Inclusive lower bound on occurred_at */
  from?: Date;
  /** Inclusive upper bound on occurred_at */
  to?: Date;
  /** Case-insensitive match on reference, counterparty or narration */
  search?: string;
  sortBy: TransactionSortField;
  sortOrder: SortOrder;
  page: number;
  limit: number;
};

export type TransactionPage = {
  items: Transaction[];
  total: number;
};

export type TransactionSummaryQuery = {
  userId: string;
  accountId?: string;
  from?: Date;
  to?: Date;
};

export type CurrencyTotals = {
  currencyCode: string;
  decimalPlaces: number;
  /** Raw decimal strings */
  income: string;
  expense: string;
  count: number;
};

export interface TransactionRepositoryPort {
  /** @throws DuplicateTransactionReferenceError */
  create(input: CreateTransactionInput): Promise<Transaction>;
  findByIdForUser(id: string, userId: string): Promise<Transaction | null>;
  findMany(query: ListTransactionsQuery): Promise<TransactionPage>;
  update(id: string, input: UpdateTransactionInput): Promise<Transaction>;
  delete(id: string): Promise<void>;
  /** Completed-only totals grouped by currency (wallets never mix currencies). */
  summarize(query: TransactionSummaryQuery): Promise<CurrencyTotals[]>;
}
