import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWorkPort } from '@/shared/database/unit-of-work.port';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisherPort,
} from '@/shared/events/domain-event-publisher.port';
import {
  TRANSACTION_DELETED_EVENT,
  TransactionDeletedPayload,
  TransactionSnapshot,
  toTransactionSnapshot,
} from '../domain/events/transaction.events';
import {
  TRANSACTION_REPOSITORY,
  TransactionRepositoryPort,
} from '../domain/ports/transaction.repository.port';

export type DeleteTransactionCommand = {
  userId: string;
  transactionId: string;
};

/** Hard delete — the activity log keeps the audit trail. */
@Injectable()
export class DeleteTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepositoryPort,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisherPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: DeleteTransactionCommand): Promise<TransactionSnapshot> {
    const existing = await this.transactions.findByIdForUser(
      command.transactionId,
      command.userId,
    );
    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }

    const snapshot = toTransactionSnapshot(existing);
    // The delete and its transaction.deleted event commit together.
    await this.unitOfWork.run(async () => {
      await this.transactions.delete(existing.id);
      const payload: TransactionDeletedPayload = { transaction: snapshot };
      await this.events.emit(TRANSACTION_DELETED_EVENT, payload);
    });
    return snapshot;
  }
}
