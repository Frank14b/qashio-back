/**
 * Settlement state. Only `completed` transactions count toward balances,
 * summaries and budgets. Persisted only for now — the API always creates
 * `completed` entries and does not accept status changes yet.
 */
export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export const TRANSACTION_STATUSES = Object.values(TransactionStatus);
