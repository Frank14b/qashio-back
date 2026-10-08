import Decimal from 'decimal.js';

/** Percent of the limit at which the user is alerted, highest first. */
export const BUDGET_ALERT_THRESHOLDS = [100, 80] as const;
export type BudgetAlertThreshold = (typeof BUDGET_ALERT_THRESHOLDS)[number];

export type BudgetStatus = 'ok' | 'warning' | 'exceeded';

export function usedPercent(spent: Decimal.Value, limit: Decimal.Value): Decimal {
  return new Decimal(spent).div(limit).times(100);
}

export function budgetStatus(spent: Decimal.Value, limit: Decimal.Value): BudgetStatus {
  const percent = usedPercent(spent, limit);
  if (percent.gte(100)) return 'exceeded';
  if (percent.gte(80)) return 'warning';
  return 'ok';
}

/**
 * Highest threshold newly reached when spending moves from `previousSpent`
 * to `currentSpent`, or `null`. Only upward crossings count, so a budget that
 * is already over its limit does not alert again on every new expense.
 */
export function crossedThreshold(
  previousSpent: Decimal.Value,
  currentSpent: Decimal.Value,
  limit: Decimal.Value,
): BudgetAlertThreshold | null {
  const before = usedPercent(previousSpent, limit);
  const after = usedPercent(currentSpent, limit);
  return BUDGET_ALERT_THRESHOLDS.find((t) => before.lt(t) && after.gte(t)) ?? null;
}
