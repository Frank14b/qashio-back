import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CategoryKind } from '@/modules/categories/domain/category-kind';
import { TRANSACTION_CREATED_EVENT } from '../domain/events/transaction.events';
import { DuplicateTransactionReferenceError } from '../domain/ports/transaction.repository.port';
import { TRANSACTION_REFERENCE_PATTERN } from '../domain/transaction-reference';
import { TransactionStatus } from '../domain/transaction-status';
import { TransactionType } from '../domain/transaction-type';
import { CreateTransactionUseCase } from './create-transaction.use-case';
import {
  makeAccount,
  makeCategory,
  makeEventPublisher,
  makeRulesDeps,
  makeTransaction,
  makeTransactionRepository,
} from '@/test-utils/transaction-fixtures';
import { TransactionRules } from './transaction-rules';

describe('CreateTransactionUseCase', () => {
  let deps: ReturnType<typeof makeRulesDeps>;
  let transactions: ReturnType<typeof makeTransactionRepository>;
  let events: ReturnType<typeof makeEventPublisher>;
  let useCase: CreateTransactionUseCase;

  const baseCommand = {
    userId: 'user-1',
    accountId: 'acc-1',
    categoryId: 'cat-food',
    type: TransactionType.EXPENSE,
    amount: '42.50',
    counterparty: '  Carrefour ',
    narration: '',
  };

  beforeEach(() => {
    deps = makeRulesDeps();
    transactions = makeTransactionRepository();
    events = makeEventPublisher();
    const rules = new TransactionRules(
      deps.accounts as never,
      deps.categories as never,
      deps.currencies as never,
    );
    useCase = new CreateTransactionUseCase(transactions as never, events as never, rules);

    deps.accounts.findByIdForUser.mockResolvedValue(makeAccount());
    deps.categories.findByIdForUser.mockResolvedValue(makeCategory());
    transactions.create.mockResolvedValue(makeTransaction());
  });

  it('records a completed entry with a generated reference and emits transaction.created', async () => {
    await useCase.execute(baseCommand);

    expect(transactions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        accountId: 'acc-1',
        type: TransactionType.EXPENSE,
        amount: '42.5',
        status: TransactionStatus.COMPLETED,
        counterparty: 'Carrefour',
        narration: null,
        reference: expect.stringMatching(TRANSACTION_REFERENCE_PATTERN),
      }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      TRANSACTION_CREATED_EVENT,
      expect.objectContaining({
        transaction: expect.objectContaining({ id: 'txn-1', currencyCode: 'USD' }),
      }),
    );
  });

  it('falls back to the default wallet when accountId is omitted', async () => {
    deps.accounts.findDefaultForUser.mockResolvedValue(makeAccount({ id: 'acc-default' }));

    await useCase.execute({ ...baseCommand, accountId: undefined });

    expect(deps.accounts.findDefaultForUser).toHaveBeenCalledWith('user-1');
    expect(transactions.create).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acc-default' }),
    );
  });

  it('retries with a new reference on collision', async () => {
    transactions.create
      .mockRejectedValueOnce(new DuplicateTransactionReferenceError('TXN-1'))
      .mockResolvedValueOnce(makeTransaction());

    await useCase.execute(baseCommand);

    expect(transactions.create).toHaveBeenCalledTimes(2);
    const [first, second] = transactions.create.mock.calls.map(
      ([input]: [{ reference: string }]) => input.reference,
    );
    expect(first).not.toBe(second);
  });

  it('rejects a category whose kind does not match the type', async () => {
    deps.categories.findByIdForUser.mockResolvedValue(
      makeCategory({ name: 'Salary', kind: CategoryKind.INCOME }),
    );

    await expect(useCase.execute(baseCommand)).rejects.toThrow('cannot be used for expense');
    expect(transactions.create).not.toHaveBeenCalled();
  });

  it('accepts a "both" category for either type', async () => {
    deps.categories.findByIdForUser.mockResolvedValue(makeCategory({ kind: CategoryKind.BOTH }));

    await useCase.execute({ ...baseCommand, type: TransactionType.INCOME });

    expect(transactions.create).toHaveBeenCalled();
  });

  it('rejects archived wallets', async () => {
    deps.accounts.findByIdForUser.mockResolvedValue(makeAccount({ archivedAt: new Date() }));

    await expect(useCase.execute(baseCommand)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 for a wallet the user does not own', async () => {
    deps.accounts.findByIdForUser.mockResolvedValue(null);

    await expect(useCase.execute(baseCommand)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects zero/negative amounts and amounts beyond the currency scale', async () => {
    await expect(useCase.execute({ ...baseCommand, amount: '0' })).rejects.toThrow(
      'greater than 0',
    );
    await expect(useCase.execute({ ...baseCommand, amount: '-5' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(useCase.execute({ ...baseCommand, amount: '1.999' })).rejects.toThrow(
      'USD allows 2',
    );
    expect(transactions.create).not.toHaveBeenCalled();
  });
});
