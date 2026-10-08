import { Injectable } from '@nestjs/common';
import { OnDomainEvent } from '@/shared/events/on-domain-event.decorator';
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
  onTransactionCreated({ transaction }: TransactionCreatedPayload) {
    return this.notify(content.transactionCreated(transaction));
  }

  @OnDomainEvent(TRANSACTION_UPDATED_EVENT)
  onTransactionUpdated({ current }: TransactionUpdatedPayload) {
    return this.notify(content.transactionUpdated(current));
  }

  @OnDomainEvent(TRANSACTION_DELETED_EVENT)
  onTransactionDeleted({ transaction }: TransactionDeletedPayload) {
    return this.notify(content.transactionDeleted(transaction));
  }

  @OnDomainEvent(BUDGET_THRESHOLD_REACHED_EVENT)
  onBudgetThresholdReached(payload: BudgetThresholdReachedPayload) {
    return this.notify(content.budgetThresholdReached(payload));
  }

  @OnDomainEvent(ACCOUNT_CREATED_EVENT)
  onAccountCreated(payload: AccountCreatedPayload) {
    return this.notify(content.accountCreated(payload));
  }

  @OnDomainEvent(ACCOUNT_UPDATED_EVENT)
  onAccountUpdated(payload: AccountUpdatedPayload) {
    return this.notify(content.accountUpdated(payload));
  }

  // Errors propagate so the queue retries the job (the source write is already committed).
  private async notify(draft: NotificationDraft): Promise<void> {
    await this.notifyUser.execute(draft);
  }
}
