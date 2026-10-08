import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  BUDGET_REPOSITORY,
  BudgetRepositoryPort,
} from '../domain/ports/budget.repository.port';

@Injectable()
export class DeleteBudgetUseCase {
  constructor(@Inject(BUDGET_REPOSITORY) private readonly budgets: BudgetRepositoryPort) {}

  async execute(userId: string, budgetId: string): Promise<{ id: string }> {
    const existing = await this.budgets.findByIdForUser(budgetId, userId);
    if (!existing) {
      throw new NotFoundException('Budget not found');
    }
    await this.budgets.delete(existing.id);
    return { id: existing.id };
  }
}
