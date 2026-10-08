import { Injectable } from '@nestjs/common';
import { OnDomainEvent } from '@/shared/events/on-domain-event.decorator';
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
  constructor(private readonly evaluateThresholds: EvaluateBudgetThresholdsUseCase) {}

  @OnDomainEvent(TRANSACTION_CREATED_EVENT)
  onCreated({ transaction }: TransactionCreatedPayload): Promise<void> {
    return this.evaluate({ userId: transaction.userId, before: null, after: transaction });
  }

  @OnDomainEvent(TRANSACTION_UPDATED_EVENT)
  onUpdated({ previous, current }: TransactionUpdatedPayload): Promise<void> {
    return this.evaluate({ userId: current.userId, before: previous, after: current });
  }

  @OnDomainEvent(TRANSACTION_DELETED_EVENT)
  onDeleted({ transaction }: TransactionDeletedPayload): Promise<void> {
    return this.evaluate({ userId: transaction.userId, before: transaction, after: null });
  }

  // Errors propagate so the queue retries the job (the transaction is already committed).
  private async evaluate(change: TransactionChange): Promise<void> {
    await this.evaluateThresholds.execute(change);
  }
}
