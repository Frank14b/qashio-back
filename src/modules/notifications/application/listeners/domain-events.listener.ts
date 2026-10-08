import { Injectable } from '@nestjs/common';
import { DomainEventContext, OnDomainEvent } from '@/shared/events/on-domain-event.decorator';
import {
  ACCOUNT_CREATED_EVENT,
  ACCOUNT_UPDATED_EVENT,
  AccountCreatedPayload,
  AccountUpdatedPayload,
} from '@/modules/accounts/domain/events/account.events';
import {
  BUDGET_THRESHOLD_REACHED_EVENT,
  BudgetThresholdReachedPayload,
} from '@/modules/budgets/domain/events/budget.events';
import {
  TRANSACTION_CREATED_EVENT,
  TRANSACTION_DELETED_EVENT,
  TRANSACTION_UPDATED_EVENT,
  TransactionCreatedPayload,
  TransactionDeletedPayload,
  TransactionUpdatedPayload,
} from '@/modules/transactions/domain/events/transaction.events';
import * as content from '../notification-content';
import { NotificationDraft } from '../notification-content';
import { NotifyUserUseCase } from '../notify-user.use-case';

@Injectable()
export class DomainEventsListener {
  constructor(private readonly notifyUser: NotifyUserUseCase) {}

  @OnDomainEvent(TRANSACTION_CREATED_EVENT)
  onTransactionCreated({ transaction }: TransactionCreatedPayload, context: DomainEventContext) {
    return this.notify(content.transactionCreated(transaction), context);
  }

  @OnDomainEvent(TRANSACTION_UPDATED_EVENT)
  onTransactionUpdated({ current }: TransactionUpdatedPayload, context: DomainEventContext) {
    return this.notify(content.transactionUpdated(current), context);
  }

  @OnDomainEvent(TRANSACTION_DELETED_EVENT)
  onTransactionDeleted({ transaction }: TransactionDeletedPayload, context: DomainEventContext) {
    return this.notify(content.transactionDeleted(transaction), context);
  }

  @OnDomainEvent(BUDGET_THRESHOLD_REACHED_EVENT)
  onBudgetThresholdReached(payload: BudgetThresholdReachedPayload, context: DomainEventContext) {
    return this.notify(content.budgetThresholdReached(payload), context);
  }

  @OnDomainEvent(ACCOUNT_CREATED_EVENT)
  onAccountCreated(payload: AccountCreatedPayload, context: DomainEventContext) {
    return this.notify(content.accountCreated(payload), context);
  }

  @OnDomainEvent(ACCOUNT_UPDATED_EVENT)
  onAccountUpdated(payload: AccountUpdatedPayload, context: DomainEventContext) {
    return this.notify(content.accountUpdated(payload), context);
  }

  // Errors propagate so the queue retries the job (the source write is already committed).
  // The event id makes a redelivered event store (and email) at most once.
  private async notify(draft: NotificationDraft, { eventId }: DomainEventContext): Promise<void> {
    await this.notifyUser.execute({ ...draft, eventId });
  }
}
