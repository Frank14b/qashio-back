import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { parseMoneyInput } from '@/shared/money/money-input';
import { BudgetPeriod } from '../domain/budget-period';
import { Budget } from '../domain/entities/budget.entity';
import {
  BUDGET_REPOSITORY,
  BudgetRepositoryPort,
  DuplicateBudgetScopeError,
} from '../domain/ports/budget.repository.port';

/** Scope (category, wallet) is fixed; create another budget to change it. */
export type UpdateBudgetCommand = {
  userId: string;
  budgetId: string;
  amount?: string | number;
  period?: BudgetPeriod;
};

@Injectable()
export class UpdateBudgetUseCase {
  constructor(@Inject(BUDGET_REPOSITORY) private readonly budgets: BudgetRepositoryPort) {}

  async execute(command: UpdateBudgetCommand): Promise<Budget> {
    const existing = await this.budgets.findByIdForUser(command.budgetId, command.userId);
    if (!existing) {
      throw new NotFoundException('Budget not found');
    }

    const amount =
      command.amount !== undefined
        ? parseMoneyInput(command.amount, {
            field: 'amount',
            decimalPlaces: existing.account.decimalPlaces,
            currencyCode: existing.currencyCode,
            positive: true,
          })
        : undefined;

    try {
      return await this.budgets.update(existing.id, { amount, period: command.period });
    } catch (error) {
      if (error instanceof DuplicateBudgetScopeError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
