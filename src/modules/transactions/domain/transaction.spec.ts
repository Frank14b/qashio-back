import { makeTransaction } from '@/test-utils/transaction-fixtures';
import {
  TRANSACTION_REFERENCE_PATTERN,
  generateTransactionReference,
} from './transaction-reference';
import { TransactionType } from './transaction-type';

describe('generateTransactionReference', () => {
  it('builds TXN-YYMMDD-XXXXXX from the UTC date', () => {
    const reference = generateTransactionReference(new Date('2026-10-07T23:30:00.000Z'));

    expect(reference).toMatch(TRANSACTION_REFERENCE_PATTERN);
    expect(reference.startsWith('TXN-261007-')).toBe(true);
  });

  it('produces distinct values', () => {
    const references = new Set(Array.from({ length: 500 }, () => generateTransactionReference()));
    expect(references.size).toBe(500);
  });
});

describe('Transaction direction', () => {
  it('treats income as inflow and expense as outflow', () => {
    const income = makeTransaction({ type: TransactionType.INCOME, amount: '10.0000' });
    const expense = makeTransaction({ type: TransactionType.EXPENSE, amount: '10.0000' });

    expect(income.direction).toBe('in');
    expect(income.signedAmount).toBe('10.0000');
    expect(expense.direction).toBe('out');
    expect(expense.signedAmount).toBe('-10.0000');
  });
});
