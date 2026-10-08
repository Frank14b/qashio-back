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

/** Raised by `create` when the user already has a transaction with this idempotency key. */
export class DuplicateIdempotencyKeyError extends Error {
  constructor(idempotencyKey: string) {
    super(`Idempotency key already used: ${idempotencyKey}`);
    this.name = 'DuplicateIdempotencyKeyError';
  }
}

export type CreateTransactionInput = {
  reference: string;
  idempotencyKey: string;
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

/** A new entry that looks like one the user just recorded (likely re-entered by mistake). */
export type PossibleDuplicateQuery = {
  userId: string;
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amount: string;
  /** When set, only entries with the same counterparty (case-insensitive) match. */
  counterparty: string | null;
  /** Only entries created at or after this instant match. */
  createdSince: Date;
  /** Rows created by this same request key are retries, not look-alikes. */
  excludeIdempotencyKey: string;
};

export interface TransactionRepositoryPort {
  /** @throws DuplicateTransactionReferenceError | DuplicateIdempotencyKeyError */
  create(input: CreateTransactionInput): Promise<Transaction>;
  findByIdForUser(id: string, userId: string): Promise<Transaction | null>;
  findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<Transaction | null>;
  /** Most recent match, if any. */
  findPossibleDuplicate(query: PossibleDuplicateQuery): Promise<Transaction | null>;
  findMany(query: ListTransactionsQuery): Promise<TransactionPage>;
  update(id: string, input: UpdateTransactionInput): Promise<Transaction>;
  delete(id: string): Promise<void>;
  /** Completed-only totals grouped by currency (wallets never mix currencies). */
  summarize(query: TransactionSummaryQuery): Promise<CurrencyTotals[]>;
}
