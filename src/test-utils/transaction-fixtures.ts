import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { CategoryKind } from '@/modules/categories/domain/category-kind';
import { Category } from '@/modules/categories/domain/entities/category.entity';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { TransactionStatus } from '@/modules/transactions/domain/transaction-status';
import { TransactionType } from '@/modules/transactions/domain/transaction-type';

const now = new Date('2026-10-07T09:00:00.000Z');

export function makeAccount(overrides: Partial<ConstructorParameters<typeof Account>[0]> = {}) {
  return new Account({
    id: 'acc-1',
    userId: 'user-1',
    name: 'Cash',
    currencyCode: 'USD',
    openingBalance: '0',
    isDefault: true,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

export function makeCategory(overrides: Partial<ConstructorParameters<typeof Category>[0]> = {}) {
  return new Category({
    id: 'cat-food',
    userId: 'user-1',
    name: 'Food',
    kind: CategoryKind.EXPENSE,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

export function makeTransaction(
  overrides: Partial<ConstructorParameters<typeof Transaction>[0]> = {},
): Transaction {
  return new Transaction({
    id: 'txn-1',
    reference: 'TXN-261007-ABC123',
    userId: 'user-1',
    accountId: 'acc-1',
    categoryId: 'cat-food',
    type: TransactionType.EXPENSE,
    amount: '42.5000',
    status: TransactionStatus.COMPLETED,
    counterparty: 'Carrefour',
    narration: null,
    occurredAt: now,
    createdAt: now,
    updatedAt: now,
    account: { id: 'acc-1', name: 'Cash', currencyCode: 'USD', decimalPlaces: 2 },
    category: { id: 'cat-food', name: 'Food', kind: CategoryKind.EXPENSE },
    ...overrides,
  });
}

export function makeRulesDeps() {
  return {
    accounts: {
      findByIdForUser: jest.fn(),
      findDefaultForUser: jest.fn(),
    },
    categories: {
      findByIdForUser: jest.fn(),
    },
    currencies: {
      findByCode: jest.fn(async (code: string) => ({
        code,
        name: code,
        symbol: '$',
        decimalPlaces: code === 'XAF' ? 0 : 2,
      })),
    },
  };
}

export function makeTransactionRepository() {
  return {
    create: jest.fn(),
    findByIdForUser: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    summarize: jest.fn(),
  };
}

export function makeEventPublisher() {
  return { emit: jest.fn() };
}
