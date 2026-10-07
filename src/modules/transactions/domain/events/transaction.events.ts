import { Transaction } from '../entities/transaction.entity';
import { TransactionStatus } from '../transaction-status';
import { TransactionType } from '../transaction-type';

export const TRANSACTION_CREATED_EVENT = 'transaction.created';
export const TRANSACTION_UPDATED_EVENT = 'transaction.updated';
export const TRANSACTION_DELETED_EVENT = 'transaction.deleted';

/** Plain, serializable view of a transaction for event listeners (budgets, logs). */
export type TransactionSnapshot = {
  id: string;
  reference: string;
  userId: string;
  accountId: string;
  categoryId: string;
  categoryName: string;
  type: TransactionType;
  amount: string;
  currencyCode: string;
  status: TransactionStatus;
  counterparty: string | null;
  occurredAt: string;
};

export type TransactionCreatedPayload = { transaction: TransactionSnapshot };
/** Both sides are provided so listeners can apply the delta (e.g. budget usage). */
export type TransactionUpdatedPayload = {
  previous: TransactionSnapshot;
  current: TransactionSnapshot;
};
export type TransactionDeletedPayload = { transaction: TransactionSnapshot };

export function toTransactionSnapshot(transaction: Transaction): TransactionSnapshot {
  return {
    id: transaction.id,
    reference: transaction.reference,
    userId: transaction.userId,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId,
    categoryName: transaction.category.name,
    type: transaction.type,
    amount: transaction.amount,
    currencyCode: transaction.account.currencyCode,
    status: transaction.status,
    counterparty: transaction.counterparty,
    occurredAt: transaction.occurredAt.toISOString(),
  };
}
