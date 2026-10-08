/** Mirrors the domain event that produced the notification. */
export enum NotificationType {
  TRANSACTION_CREATED = 'transaction.created',
  TRANSACTION_UPDATED = 'transaction.updated',
  TRANSACTION_DELETED = 'transaction.deleted',
  BUDGET_THRESHOLD_REACHED = 'budget.threshold_reached',
  ACCOUNT_CREATED = 'account.created',
  ACCOUNT_UPDATED = 'account.updated',
}
