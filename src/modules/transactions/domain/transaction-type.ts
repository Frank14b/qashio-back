/**
 * Direction of money for a transaction.
 *
 * `amount` is always stored as a positive number; the sign comes from `type`:
 * - `income`  → money flows INTO the wallet  (+amount)
 * - `expense` → money flows OUT of the wallet (−amount)
 */
export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export const TRANSACTION_TYPES = Object.values(TransactionType);

export type TransactionDirection = 'in' | 'out';

export function directionOf(type: TransactionType): TransactionDirection {
  return type === TransactionType.INCOME ? 'in' : 'out';
}
