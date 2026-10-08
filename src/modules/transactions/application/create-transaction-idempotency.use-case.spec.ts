import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import {
  makeAccount,
  makeCategory,
  makeEventPublisher,
  makeRulesDeps,
  makeTransaction,
  makeTransactionRepository,
} from '@/test-utils/transaction-fixtures';
import { DuplicateIdempotencyKeyError } from '../domain/ports/transaction.repository.port';
import { TransactionType } from '../domain/transaction-type';
import { CreateTransactionUseCase, POSSIBLE_DUPLICATE_CODE } from './create-transaction.use-case';
import { TransactionRules } from './transaction-rules';

describe('CreateTransactionUseCase — duplicate protection', () => {
  let deps: ReturnType<typeof makeRulesDeps>;
  let transactions: ReturnType<typeof makeTransactionRepository>;
  let events: ReturnType<typeof makeEventPublisher>;
  let useCase: CreateTransactionUseCase;

  const command = {
    userId: 'user-1',
    idempotencyKey: '6f1c2b9e-1d4a-4c3e-9b7a-2f8d5e0a1c34',
    accountId: 'acc-1',
    categoryId: 'cat-food',
    type: TransactionType.EXPENSE,
    amount: '42.50',
    counterparty: 'Carrefour',
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

  it('replays a retried request without saving or emitting again', async () => {
    const original = makeTransaction();
    transactions.findByIdempotencyKey.mockResolvedValue(original);

    const result = await useCase.execute(command);

    expect(result).toEqual({ transaction: original, replayed: true });
    expect(transactions.create).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('rejects a reused key carrying a different payload', async () => {
    transactions.findByIdempotencyKey.mockResolvedValue(makeTransaction());

    await expect(useCase.execute({ ...command, amount: '99' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(transactions.create).not.toHaveBeenCalled();
  });

  it('answers the loser of a concurrent same-key insert with the winner', async () => {
    const winner = makeTransaction();
    transactions.create.mockRejectedValue(new DuplicateIdempotencyKeyError(command.idempotencyKey));
    transactions.findByIdempotencyKey.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);

    const result = await useCase.execute(command);

    expect(result).toEqual({ transaction: winner, replayed: true });
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('asks for confirmation when a look-alike was just recorded, and saves once confirmed', async () => {
    transactions.findPossibleDuplicate.mockResolvedValue(makeTransaction({ id: 'txn-earlier' }));

    const warning = await useCase.execute(command).catch((error: unknown) => error);

    expect(warning).toBeInstanceOf(ConflictException);
    expect((warning as ConflictException).getResponse()).toMatchObject({
      code: POSSIBLE_DUPLICATE_CODE,
      details: { duplicateOf: { id: 'txn-earlier', amount: '42.50', currencyCode: 'USD' } },
    });
    expect(transactions.findPossibleDuplicate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '42.5', excludeIdempotencyKey: command.idempotencyKey }),
    );
    expect(transactions.create).not.toHaveBeenCalled();

    const result = await useCase.execute({ ...command, confirmDuplicate: true });

    expect(result.replayed).toBe(false);
    expect(transactions.create).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: command.idempotencyKey }),
    );
  });
});
