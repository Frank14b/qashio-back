import { Inject, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { TransactionSnapshot } from '@/modules/transactions/domain/events/transaction.events';
import { TransactionStatus } from '@/modules/transactions/domain/transaction-status';
import { TransactionType } from '@/modules/transactions/domain/transaction-type';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisherPort,
} from '@/shared/events/domain-event-publisher.port';
import { crossedThreshold } from '../domain/budget-thresholds';
import { Budget, BudgetUsage } from '../domain/entities/budget.entity';
import {
  BUDGET_THRESHOLD_REACHED_EVENT,
  BudgetThresholdReachedPayload,
} from '../domain/events/budget.events';
import {
  BUDGET_REPOSITORY,
  BudgetRepositoryPort,
} from '../domain/ports/budget.repository.port';

/** A transaction change: `before` is null on create, `after` is null on delete. */
export type TransactionChange = {
  userId: string;
  before: TransactionSnapshot | null;
  after: TransactionSnapshot | null;
  /** Id of the transaction event being handled; makes a retried evaluation alert once. */
  sourceEventId?: string;
};

/**
 * Runs after a transaction write has committed. Usage is read from the DB
 * (it already includes the change); the usage *before* the change is that
 * minus this change's contribution. An alert is emitted only when this
 * change crosses a threshold, so repeated expenses over the limit stay quiet.
 */
@Injectable()
export class EvaluateBudgetThresholdsUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY) private readonly budgets: BudgetRepositoryPort,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisherPort,
  ) {}

  async execute(change: TransactionChange): Promise<void> {
    const counted = [change.before, change.after].filter(
      (s): s is TransactionSnapshot =>
        s !== null &&
        s.type === TransactionType.EXPENSE &&
        s.status === TransactionStatus.COMPLETED,
    );
    if (counted.length === 0) {
      return;
    }

    const budgets = await this.budgets.findByCategories(change.userId, [
      ...new Set(counted.map((s) => s.categoryId)),
    ]);
    if (budgets.length === 0) {
      return;
    }
    const usage = await this.budgets.getUsage(budgets.map((b) => b.id));

    for (const budget of budgets) {
      const current = usage.get(budget.id);
      if (!current) continue;

      const delta = this.contribution(budget, current, change.after).minus(
        this.contribution(budget, current, change.before),
      );
      if (delta.isZero()) continue;

      const threshold = crossedThreshold(
        new Decimal(current.spent).minus(delta),
        current.spent,
        budget.amount,
      );
      if (threshold === null) continue;

      const payload: BudgetThresholdReachedPayload = {
        userId: budget.userId,
        budgetId: budget.id,
        categoryName: budget.category.name,
        currencyCode: budget.currencyCode,
        period: budget.period,
        threshold,
        amount: budget.amount,
        spent: current.spent,
        periodStart: current.periodStart.toISOString(),
        periodEnd: current.periodEnd.toISOString(),
      };
      // Same source event + budget + threshold = same alert, even if this job is retried.
      const dedupeKey =
        change.sourceEventId && `${change.sourceEventId}:${budget.id}:${threshold}`;
      await (dedupeKey
        ? this.events.emit(BUDGET_THRESHOLD_REACHED_EVENT, payload, { dedupeKey })
        : this.events.emit(BUDGET_THRESHOLD_REACHED_EVENT, payload));
    }
  }

  /** Amount this snapshot adds to the budget's current-period usage. */
  private contribution(
    budget: Budget,
    usage: BudgetUsage,
    snapshot: TransactionSnapshot | null,
  ): Decimal {
    if (
      !snapshot ||
      snapshot.type !== TransactionType.EXPENSE ||
      snapshot.status !== TransactionStatus.COMPLETED ||
      snapshot.categoryId !== budget.categoryId ||
      snapshot.accountId !== budget.accountId
    ) {
      return new Decimal(0);
    }
    const occurredAt = new Date(snapshot.occurredAt);
    const inPeriod = occurredAt >= usage.periodStart && occurredAt < usage.periodEnd;
    return inPeriod ? new Decimal(snapshot.amount) : new Decimal(0);
  }
}
