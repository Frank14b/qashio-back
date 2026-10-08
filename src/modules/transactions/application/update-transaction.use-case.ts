import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWorkPort } from '@/shared/database/unit-of-work.port';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisherPort,
} from '@/shared/events/domain-event-publisher.port';
import { Transaction } from '../domain/entities/transaction.entity';
import {
  TRANSACTION_UPDATED_EVENT,
  TransactionUpdatedPayload,
  toTransactionSnapshot,
} from '../domain/events/transaction.events';
import {
  TRANSACTION_REPOSITORY,
  TransactionRepositoryPort,
  UpdateTransactionInput,
} from '../domain/ports/transaction.repository.port';
import { TransactionType } from '../domain/transaction-type';
import { TransactionRules, cleanOptionalText } from './transaction-rules';

export type UpdateTransactionCommand = {
  userId: string;
  transactionId: string;
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  amount?: string | number;
  /** `null` or blank clears it */
  counterparty?: string | null;
  /** `null` or blank clears it */
  narration?: string | null;
  occurredAt?: Date;
};

@Injectable()
export class UpdateTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepositoryPort,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisherPort,
    private readonly rules: TransactionRules,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: UpdateTransactionCommand): Promise<Transaction> {
    const existing = await this.transactions.findByIdForUser(
      command.transactionId,
      command.userId,
    );
    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }

    // "At least one field" is validated by UpdateTransactionRequestDto.
    const { userId } = command;
    const patch: UpdateTransactionInput = {};

    let currencyCode = existing.account.currencyCode;
    if (command.accountId !== undefined && command.accountId !== existing.accountId) {
      const account = await this.rules.requireActiveAccount(userId, command.accountId);
      // Moving across currencies would silently change the value of the entry.
      if (account.currencyCode !== existing.account.currencyCode) {
        throw new BadRequestException(
          `Cannot move a ${existing.account.currencyCode} transaction to a ${account.currencyCode} account`,
        );
      }
      currencyCode = account.currencyCode;
      patch.accountId = account.id;
    }

    const type = command.type ?? existing.type;
    const categoryId = command.categoryId ?? existing.categoryId;
    if (type !== existing.type || categoryId !== existing.categoryId) {
      await this.rules.requireCompatibleCategory(userId, categoryId, type);
      patch.type = type;
      patch.categoryId = categoryId;
    }

    if (command.amount !== undefined) {
      patch.amount = await this.rules.parseAmount(command.amount, currencyCode);
    }
    patch.counterparty = cleanOptionalText(command.counterparty);
    patch.narration = cleanOptionalText(command.narration);
    patch.occurredAt = command.occurredAt;

    // The change and its transaction.updated event commit together.
    return this.unitOfWork.run(async () => {
      const updated = await this.transactions.update(existing.id, patch);
      const payload: TransactionUpdatedPayload = {
        previous: toTransactionSnapshot(existing),
        current: toTransactionSnapshot(updated),
      };
      await this.events.emit(TRANSACTION_UPDATED_EVENT, payload);
      return updated;
    });
  }
}
