import { BudgetPeriod } from '../budget-period';
import { Budget, BudgetUsage } from '../entities/budget.entity';

export const BUDGET_REPOSITORY = Symbol('BUDGET_REPOSITORY');

/** Raised when a category already has a budget for the same wallet and period. */
export class DuplicateBudgetScopeError extends Error {
  constructor(message = 'A budget already exists for this category, wallet and period') {
    super(message);
    this.name = 'DuplicateBudgetScopeError';
  }
}

export type CreateBudgetsInput = {
  userId: string;
  accountId: string;
  /** One budget is created per category, all with the same limit and period. */
  categoryIds: string[];
  amount: string;
  period: BudgetPeriod;
};

export type UpdateBudgetInput = Partial<Pick<CreateBudgetsInput, 'amount' | 'period'>>;

export interface BudgetRepositoryPort {
  /** Atomic: all budgets are created or none. @throws DuplicateBudgetScopeError */
  createMany(input: CreateBudgetsInput): Promise<Budget[]>;
  findByIdForUser(id: string, userId: string): Promise<Budget | null>;
  findByUser(userId: string): Promise<Budget[]>;
  /** Budgets of a user covering any of the given categories. */
  findByCategories(userId: string, categoryIds: string[]): Promise<Budget[]>;
  /** @throws DuplicateBudgetScopeError when a period change collides with another budget */
  update(id: string, input: UpdateBudgetInput): Promise<Budget>;
  delete(id: string): Promise<void>;
  /** Current-period usage keyed by budget id. */
  getUsage(budgetIds: string[]): Promise<Map<string, BudgetUsage>>;
}
