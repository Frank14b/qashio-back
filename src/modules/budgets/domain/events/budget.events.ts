import { BudgetPeriod } from '../budget-period';
import { BudgetAlertThreshold } from '../budget-thresholds';

/** Spending crossed 80% or 100% of a budget in its current period. */
export const BUDGET_THRESHOLD_REACHED_EVENT = 'budget.threshold_reached';

export type BudgetThresholdReachedPayload = {
  userId: string;
  budgetId: string;
  categoryName: string;
  currencyCode: string;
  period: BudgetPeriod;
  threshold: BudgetAlertThreshold;
  /** Decimal strings */
  amount: string;
  spent: string;
  periodStart: string;
  periodEnd: string;
};
