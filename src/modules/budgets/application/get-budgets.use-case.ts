import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Budget, BudgetUsage } from '../domain/entities/budget.entity';
import {
  BUDGET_REPOSITORY,
  BudgetRepositoryPort,
} from '../domain/ports/budget.repository.port';

export type BudgetWithUsage = { budget: Budget; usage: BudgetUsage };

/** Budgets with their current-period spending (derived, never stored). */
@Injectable()
export class GetBudgetsUseCase {
  constructor(@Inject(BUDGET_REPOSITORY) private readonly budgets: BudgetRepositoryPort) {}

  async list(userId: string): Promise<BudgetWithUsage[]> {
    return this.attachUsage(await this.budgets.findByUser(userId));
  }

  async getOne(userId: string, budgetId: string): Promise<BudgetWithUsage> {
    const budget = await this.budgets.findByIdForUser(budgetId, userId);
    if (!budget) {
      throw new NotFoundException('Budget not found');
    }
    const [result] = await this.attachUsage([budget]);
    return result;
  }

  async attachUsage(budgets: Budget[]): Promise<BudgetWithUsage[]> {
    const usage = await this.budgets.getUsage(budgets.map((b) => b.id));
    return budgets.map((budget) => {
      const found = usage.get(budget.id);
      if (!found) {
        throw new Error(`Missing usage for budget ${budget.id}`);
      }
      return { budget, usage: found };
    });
  }
}
