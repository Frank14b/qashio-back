/** Usage resets at the start of each period (ISO weeks start on Monday). */
export enum BudgetPeriod {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export const BUDGET_PERIODS = Object.values(BudgetPeriod);
