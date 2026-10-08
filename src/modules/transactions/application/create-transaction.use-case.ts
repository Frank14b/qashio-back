import {
  ConflictException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisherPort,
} from '@/shared/events/domain-event-publisher.port';
import { formatMoney } from '@/shared/money/money-input';
import { Transaction } from '../domain/entities/transaction.entity';
import {
  TRANSACTION_CREATED_EVENT,
  TransactionCreatedPayload,
  toTransactionSnapshot,
} from '../domain/events/transaction.events';
import {
  DuplicateIdempotencyKeyError,
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
  /** Client-generated per user action; a retry with the same key replays the first result. */
  idempotencyKey: string;
  /** Save even if it looks like an entry the user just recorded. */
  confirmDuplicate?: boolean;
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

export type CreateTransactionResult = {
  transaction: Transaction;
  /** True when this is a retry of an already-recorded request (nothing new was saved). */
  replayed: boolean;
};

export const POSSIBLE_DUPLICATE_CODE = 'POSSIBLE_DUPLICATE';
/** How far back an identical-looking entry counts as a likely accidental re-entry. */
export const POSSIBLE_DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

const MAX_REFERENCE_ATTEMPTS = 5;

@Injectable()
export class CreateTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepositoryPort,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisherPort,
    private readonly rules: TransactionRules,
  ) {}

  async execute(command: CreateTransactionCommand): Promise<CreateTransactionResult> {
    const previous = await this.transactions.findByIdempotencyKey(
      command.userId,
      command.idempotencyKey,
    );
    if (previous) {
      return this.replay(previous, command);
    }

    const account = await this.rules.requireActiveAccount(command.userId, command.accountId);
    await this.rules.requireCompatibleCategory(command.userId, command.categoryId, command.type);
    const amount = await this.rules.parseAmount(command.amount, account.currencyCode);
    const counterparty = cleanOptionalText(command.counterparty) ?? null;

    if (!command.confirmDuplicate) {
      const lookalike = await this.transactions.findPossibleDuplicate({
        userId: command.userId,
        accountId: account.id,
        categoryId: command.categoryId,
        type: command.type,
        amount,
        counterparty,
        createdSince: new Date(Date.now() - POSSIBLE_DUPLICATE_WINDOW_MS),
        excludeIdempotencyKey: command.idempotencyKey,
      });
      if (lookalike) {
        throw this.possibleDuplicate(lookalike);
      }
    }

    let transaction: Transaction;
    try {
      transaction = await this.insertWithUniqueReference({
        idempotencyKey: command.idempotencyKey,
        userId: command.userId,
        accountId: account.id,
        categoryId: command.categoryId,
        type: command.type,
        amount,
        status: TransactionStatus.COMPLETED,
        counterparty,
        narration: cleanOptionalText(command.narration) ?? null,
        occurredAt: command.occurredAt ?? new Date(),
      });
    } catch (error) {
      // A concurrent request with the same key won the insert: answer like a retry.
      if (!(error instanceof DuplicateIdempotencyKeyError)) {
        throw error;
      }
      const winner = await this.transactions.findByIdempotencyKey(
        command.userId,
        command.idempotencyKey,
      );
      if (!winner) {
        throw error;
      }
      return this.replay(winner, command);
    }

    const payload: TransactionCreatedPayload = {
      transaction: toTransactionSnapshot(transaction),
    };
    this.events.emit(TRANSACTION_CREATED_EVENT, payload);
    return { transaction, replayed: false };
  }

  /** Same key must mean the same request; reusing it for different data is a client bug. */
  private replay(previous: Transaction, command: CreateTransactionCommand): CreateTransactionResult {
    if (!this.matchesCommand(previous, command)) {
      throw new UnprocessableEntityException(
        'Idempotency-Key was already used for a different transaction; send a new key',
      );
    }
    return { transaction: previous, replayed: true };
  }

  /** Fields the client omitted (wallet, date) were defaulted server-side, so they always match. */
  private matchesCommand(previous: Transaction, command: CreateTransactionCommand): boolean {
    let sameAmount: boolean;
    try {
      sameAmount = new Decimal(command.amount).eq(previous.amount);
    } catch {
      sameAmount = false;
    }
    return (
      sameAmount &&
      previous.type === command.type &&
      previous.categoryId === command.categoryId &&
      (command.accountId === undefined || previous.accountId === command.accountId) &&
      previous.counterparty === (cleanOptionalText(command.counterparty) ?? null) &&
      previous.narration === (cleanOptionalText(command.narration) ?? null) &&
      (command.occurredAt === undefined ||
        previous.occurredAt.getTime() === command.occurredAt.getTime())
    );
  }

  private possibleDuplicate(lookalike: Transaction): ConflictException {
    return new ConflictException({
      code: POSSIBLE_DUPLICATE_CODE,
      message: `This looks like ${lookalike.reference}, recorded moments ago. Resend with confirmDuplicate: true to save it anyway.`,
      details: {
        duplicateOf: {
          id: lookalike.id,
          reference: lookalike.reference,
          type: lookalike.type,
          amount: formatMoney(lookalike.amount, lookalike.account.decimalPlaces),
          currencyCode: lookalike.account.currencyCode,
          counterparty: lookalike.counterparty,
          occurredAt: lookalike.occurredAt.toISOString(),
          createdAt: lookalike.createdAt.toISOString(),
        },
      },
    });
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
