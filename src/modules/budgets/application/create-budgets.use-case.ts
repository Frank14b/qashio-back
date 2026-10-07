import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '@/modules/accounts/domain/ports/account.repository.port';
import { CategoryKind } from '@/modules/categories/domain/category-kind';
import { Category } from '@/modules/categories/domain/entities/category.entity';
import {
  CATEGORY_REPOSITORY,
  CategoryRepositoryPort,
} from '@/modules/categories/domain/ports/category.repository.port';
import {
  CURRENCY_REPOSITORY,
  CurrencyRepositoryPort,
} from '@/modules/currencies/domain/ports/currency.repository.port';
import { parseMoneyInput } from '@/shared/money/money-input';
import { BudgetPeriod } from '../domain/budget-period';
import { Budget } from '../domain/entities/budget.entity';
import {
  BUDGET_REPOSITORY,
  BudgetRepositoryPort,
  DuplicateBudgetScopeError,
} from '../domain/ports/budget.repository.port';

export type CreateBudgetsCommand = {
  userId: string;
  accountId: string;
  /** One budget per category, all with the same limit and period (unique ids). */
  categoryIds: string[];
  amount: string | number;
  period: BudgetPeriod;
};

/** Creates one budget per category on a wallet; the currency is the wallet's. */
@Injectable()
export class CreateBudgetsUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY) private readonly budgets: BudgetRepositoryPort,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepositoryPort,
    @Inject(CURRENCY_REPOSITORY) private readonly currencies: CurrencyRepositoryPort,
  ) {}

  async execute(command: CreateBudgetsCommand): Promise<Budget[]> {
    const account = await this.accounts.findByIdForUser(command.accountId, command.userId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    if (account.isArchived) {
      throw new BadRequestException('Cannot budget on an archived account');
    }

    const owned = new Map(
      (await this.categories.findByUserId(command.userId)).map((c) => [c.id, c]),
    );
    const categories = command.categoryIds
      .map((id) => owned.get(id))
      .filter((category): category is Category => category !== undefined);
    if (categories.length !== command.categoryIds.length) {
      throw new NotFoundException('Category not found');
    }
    const incomeOnly = categories.filter((c) => c.kind === CategoryKind.INCOME);
    if (incomeOnly.length > 0) {
      throw new BadRequestException(
        `Budgets track spending; income categories can't be budgeted: ${incomeOnly.map((c) => c.name).join(', ')}`,
      );
    }

    const currency = await this.currencies.findByCode(account.currencyCode);
    if (!currency) {
      throw new BadRequestException(`Unknown currency: ${account.currencyCode}`);
    }
    const amount = parseMoneyInput(command.amount, {
      field: 'amount',
      decimalPlaces: currency.decimalPlaces,
      currencyCode: currency.code,
      positive: true,
    });

    // Name the clashing categories instead of failing on the unique index.
    const taken = (await this.budgets.findByCategories(command.userId, command.categoryIds)).filter(
      (b) => b.accountId === account.id && b.period === command.period,
    );
    if (taken.length > 0) {
      throw new ConflictException(
        `Already budgeted ${command.period} on "${account.name}": ${taken.map((b) => b.category.name).join(', ')}`,
      );
    }

    try {
      return await this.budgets.createMany({
        userId: command.userId,
        accountId: account.id,
        categoryIds: command.categoryIds,
        amount,
        period: command.period,
      });
    } catch (error) {
      if (error instanceof DuplicateBudgetScopeError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
