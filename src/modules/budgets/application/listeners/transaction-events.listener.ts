import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  TRANSACTION_CREATED_EVENT,
  TRANSACTION_DELETED_EVENT,
  TRANSACTION_UPDATED_EVENT,
  TransactionCreatedPayload,
  TransactionDeletedPayload,
  TransactionUpdatedPayload,
} from '@/modules/transactions/domain/events/transaction.events';
import {
  EvaluateBudgetThresholdsUseCase,
  TransactionChange,
} from '../evaluate-budget-thresholds.use-case';

@Injectable()
export class TransactionEventsListener {
  private readonly logger = new Logger(TransactionEventsListener.name);

  constructor(private readonly evaluateThresholds: EvaluateBudgetThresholdsUseCase) {}

  @OnEvent(TRANSACTION_CREATED_EVENT, { async: true })
  onCreated({ transaction }: TransactionCreatedPayload): Promise<void> {
    return this.evaluate({ userId: transaction.userId, before: null, after: transaction });
  }

  @OnEvent(TRANSACTION_UPDATED_EVENT, { async: true })
  onUpdated({ previous, current }: TransactionUpdatedPayload): Promise<void> {
    return this.evaluate({ userId: current.userId, before: previous, after: current });
  }

  @OnEvent(TRANSACTION_DELETED_EVENT, { async: true })
  onDeleted({ transaction }: TransactionDeletedPayload): Promise<void> {
    return this.evaluate({ userId: transaction.userId, before: transaction, after: null });
  }

  // Budget alerts are best-effort: the transaction is already committed.
  private async evaluate(change: TransactionChange): Promise<void> {
    try {
      await this.evaluateThresholds.execute(change);
    } catch (error) {
      this.logger.error(
        `Failed to evaluate budgets for user ${change.userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
