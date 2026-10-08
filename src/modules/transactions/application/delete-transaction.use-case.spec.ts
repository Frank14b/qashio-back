import { NotFoundException } from '@nestjs/common';
import { TRANSACTION_DELETED_EVENT } from '../domain/events/transaction.events';
import { DeleteTransactionUseCase } from './delete-transaction.use-case';
import {
  makeEventPublisher,
  makeTransaction,
  makeTransactionRepository,
} from '@/test-utils/transaction-fixtures';
import { inlineUnitOfWork } from '@/test-utils/unit-of-work';

describe('DeleteTransactionUseCase', () => {
  const transactions = makeTransactionRepository();
  const events = makeEventPublisher();
  const useCase = new DeleteTransactionUseCase(
    transactions as never,
    events as never,
    inlineUnitOfWork,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes the transaction and emits transaction.deleted', async () => {
    transactions.findByIdForUser.mockResolvedValue(makeTransaction());

    const snapshot = await useCase.execute({ userId: 'user-1', transactionId: 'txn-1' });

    expect(transactions.delete).toHaveBeenCalledWith('txn-1');
    expect(snapshot.id).toBe('txn-1');
    expect(events.emit).toHaveBeenCalledWith(TRANSACTION_DELETED_EVENT, {
      transaction: expect.objectContaining({ id: 'txn-1', type: 'expense' }),
    });
  });

  it('returns 404 without deleting when not owned', async () => {
    transactions.findByIdForUser.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId: 'user-2', transactionId: 'txn-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transactions.delete).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });
});
