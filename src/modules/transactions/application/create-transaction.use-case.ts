import { Inject, Injectable } from '@nestjs/common';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisherPort,
} from '@/shared/events/domain-event-publisher.port';
import { Transaction } from '../domain/entities/transaction.entity';
import {
  TRANSACTION_CREATED_EVENT,
  TransactionCreatedPayload,
  toTransactionSnapshot,
} from '../domain/events/transaction.events';
import {
  DuplicateTransactionReferenceError,
  TRANSACTION_REPOSITORY,
  TransactionRepositoryPort,
} from '../domain/ports/transaction.repository.port';
import { generateTransactionReference } from '../domain/transaction-reference';
import { TransactionStatus } from '../domain/transaction-status';
import { TransactionType } from '../domain/transaction-type';
import { TransactionRules, cleanOptionalText } from './transaction-rules';

export type CreateTransactionCommand = {
  userId: string;
  /** Omit to use the user's default wallet. */
  accountId?: string;
  categoryId: string;
  type: TransactionType;
  amount: string | number;
  counterparty?: string | null;
  narration?: string | null;
  /** Defaults to now. */
  occurredAt?: Date;
};

const MAX_REFERENCE_ATTEMPTS = 5;

@Injectable()
export class CreateTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepositoryPort,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisherPort,
    private readonly rules: TransactionRules,
  ) {}

  async execute(command: CreateTransactionCommand): Promise<Transaction> {
    const account = await this.rules.requireActiveAccount(command.userId, command.accountId);
    await this.rules.requireCompatibleCategory(command.userId, command.categoryId, command.type);
    const amount = await this.rules.parseAmount(command.amount, account.currencyCode);

    const transaction = await this.insertWithUniqueReference({
      userId: command.userId,
      accountId: account.id,
      categoryId: command.categoryId,
      type: command.type,
      amount,
      status: TransactionStatus.COMPLETED,
      counterparty: cleanOptionalText(command.counterparty) ?? null,
      narration: cleanOptionalText(command.narration) ?? null,
      occurredAt: command.occurredAt ?? new Date(),
    });

    const payload: TransactionCreatedPayload = {
      transaction: toTransactionSnapshot(transaction),
    };
    this.events.emit(TRANSACTION_CREATED_EVENT, payload);
    return transaction;
  }

  /** The DB unique constraint is the source of truth; regenerate on the rare collision. */
  private async insertWithUniqueReference(
    input: Omit<Parameters<TransactionRepositoryPort['create']>[0], 'reference'>,
  ): Promise<Transaction> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.transactions.create({
          ...input,
          reference: generateTransactionReference(),
        });
      } catch (error) {
        if (!(error instanceof DuplicateTransactionReferenceError) || attempt >= MAX_REFERENCE_ATTEMPTS) {
          throw error;
        }
      }
    }
  }
}
