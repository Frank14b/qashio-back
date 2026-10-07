import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
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
  private readonly logger = new Logger(DomainEventsListener.name);

  constructor(private readonly notifyUser: NotifyUserUseCase) {}

  @OnEvent(TRANSACTION_CREATED_EVENT, { async: true })
  onTransactionCreated({ transaction }: TransactionCreatedPayload) {
    return this.notify(content.transactionCreated(transaction));
  }

  @OnEvent(TRANSACTION_UPDATED_EVENT, { async: true })
  onTransactionUpdated({ current }: TransactionUpdatedPayload) {
    return this.notify(content.transactionUpdated(current));
  }

  @OnEvent(TRANSACTION_DELETED_EVENT, { async: true })
  onTransactionDeleted({ transaction }: TransactionDeletedPayload) {
    return this.notify(content.transactionDeleted(transaction));
  }

  @OnEvent(BUDGET_THRESHOLD_REACHED_EVENT, { async: true })
  onBudgetThresholdReached(payload: BudgetThresholdReachedPayload) {
    return this.notify(content.budgetThresholdReached(payload));
  }

  @OnEvent(ACCOUNT_CREATED_EVENT, { async: true })
  onAccountCreated(payload: AccountCreatedPayload) {
    return this.notify(content.accountCreated(payload));
  }

  @OnEvent(ACCOUNT_UPDATED_EVENT, { async: true })
  onAccountUpdated(payload: AccountUpdatedPayload) {
    return this.notify(content.accountUpdated(payload));
  }

  // Notifications are side effects of already-committed writes: log, never rethrow.
  private async notify(draft: NotificationDraft): Promise<void> {
    try {
      await this.notifyUser.execute(draft);
    } catch (error) {
      this.logger.error(
        `Failed to store "${draft.type}" notification for user ${draft.userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
