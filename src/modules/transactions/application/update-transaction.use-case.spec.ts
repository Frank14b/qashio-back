import { NotFoundException } from '@nestjs/common';
import { CategoryKind } from '@/modules/categories/domain/category-kind';
import { TRANSACTION_UPDATED_EVENT } from '../domain/events/transaction.events';
import { TransactionType } from '../domain/transaction-type';
import {
  makeAccount,
  makeCategory,
  makeEventPublisher,
  makeRulesDeps,
  makeTransaction,
  makeTransactionRepository,
} from '@/test-utils/transaction-fixtures';
import { TransactionRules } from './transaction-rules';
import { UpdateTransactionUseCase } from './update-transaction.use-case';
import { inlineUnitOfWork } from '@/test-utils/unit-of-work';

describe('UpdateTransactionUseCase', () => {
  let deps: ReturnType<typeof makeRulesDeps>;
  let transactions: ReturnType<typeof makeTransactionRepository>;
  let events: ReturnType<typeof makeEventPublisher>;
  let useCase: UpdateTransactionUseCase;

  beforeEach(() => {
    deps = makeRulesDeps();
    transactions = makeTransactionRepository();
    events = makeEventPublisher();
    const rules = new TransactionRules(
      deps.accounts as never,
      deps.categories as never,
      deps.currencies as never,
    );
    useCase = new UpdateTransactionUseCase(
      transactions as never,
      events as never,
      rules,
      inlineUnitOfWork,
    );

    transactions.findByIdForUser.mockResolvedValue(makeTransaction());
    transactions.update.mockResolvedValue(makeTransaction({ amount: '60.0000' }));
  });

  it('updates the amount and emits previous + current snapshots', async () => {
    await useCase.execute({ userId: 'user-1', transactionId: 'txn-1', amount: 60 });

    expect(transactions.update).toHaveBeenCalledWith(
      'txn-1',
      expect.objectContaining({ amount: '60' }),
    );
    expect(events.emit).toHaveBeenCalledWith(TRANSACTION_UPDATED_EVENT, {
      previous: expect.objectContaining({ amount: '42.5000' }),
      current: expect.objectContaining({ amount: '60.0000' }),
    });
  });

  it('re-checks the category when the type changes', async () => {
    deps.categories.findByIdForUser.mockResolvedValue(makeCategory());

    await expect(
      useCase.execute({ userId: 'user-1', transactionId: 'txn-1', type: TransactionType.INCOME }),
    ).rejects.toThrow('cannot be used for income');
    expect(transactions.update).not.toHaveBeenCalled();
  });

  it('accepts a type change with a compatible category', async () => {
    deps.categories.findByIdForUser.mockResolvedValue(
      makeCategory({ id: 'cat-salary', kind: CategoryKind.INCOME }),
    );

    await useCase.execute({
      userId: 'user-1',
      transactionId: 'txn-1',
      type: TransactionType.INCOME,
      categoryId: 'cat-salary',
    });

    expect(transactions.update).toHaveBeenCalledWith(
      'txn-1',
      expect.objectContaining({ type: TransactionType.INCOME, categoryId: 'cat-salary' }),
    );
  });

  it('refuses to move a transaction to a wallet in another currency', async () => {
    deps.accounts.findByIdForUser.mockResolvedValue(
      makeAccount({ id: 'acc-eur', currencyCode: 'EUR' }),
    );

    await expect(
      useCase.execute({ userId: 'user-1', transactionId: 'txn-1', accountId: 'acc-eur' }),
    ).rejects.toThrow('Cannot move a USD transaction to a EUR account');
  });

  it('clears counterparty when null or blank is sent', async () => {
    await useCase.execute({ userId: 'user-1', transactionId: 'txn-1', counterparty: '  ' });

    expect(transactions.update).toHaveBeenCalledWith(
      'txn-1',
      expect.objectContaining({ counterparty: null }),
    );
  });

  it('returns 404 for transactions of other users', async () => {
    transactions.findByIdForUser.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId: 'user-2', transactionId: 'txn-1', amount: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
