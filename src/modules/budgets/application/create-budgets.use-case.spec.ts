import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CategoryKind } from '@/modules/categories/domain/category-kind';
import { makeAccount, makeCategory } from '@/test-utils/transaction-fixtures';
import { BudgetPeriod } from '../domain/budget-period';
import { DuplicateBudgetScopeError } from '../domain/ports/budget.repository.port';
import { CreateBudgetsUseCase } from './create-budgets.use-case';

describe('CreateBudgetsUseCase', () => {
  const budgets = { createMany: jest.fn(), findByCategories: jest.fn() };
  const accounts = { findByIdForUser: jest.fn() };
  const categories = { findByUserId: jest.fn() };
  const currencies = { findByCode: jest.fn() };
  const useCase = new CreateBudgetsUseCase(
    budgets as never,
    accounts as never,
    categories as never,
    currencies as never,
  );

  const food = makeCategory({ id: 'cat-food', name: 'Food' });
  const transport = makeCategory({ id: 'cat-transport', name: 'Transport' });
  const salary = makeCategory({ id: 'cat-salary', name: 'Salary', kind: CategoryKind.INCOME });
  const command = {
    userId: 'user-1',
    accountId: 'acc-1',
    categoryIds: ['cat-food', 'cat-transport'],
    amount: '500.00',
    period: BudgetPeriod.MONTHLY,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    accounts.findByIdForUser.mockResolvedValue(makeAccount());
    categories.findByUserId.mockResolvedValue([food, transport, salary]);
    currencies.findByCode.mockResolvedValue({ code: 'USD', decimalPlaces: 2 });
    budgets.findByCategories.mockResolvedValue([]);
    budgets.createMany.mockResolvedValue([]);
  });

  it('creates one budget per category on the wallet, in its currency scale', async () => {
    await useCase.execute(command);

    expect(currencies.findByCode).toHaveBeenCalledWith('USD');
    expect(budgets.createMany).toHaveBeenCalledWith({
      userId: 'user-1',
      accountId: 'acc-1',
      categoryIds: ['cat-food', 'cat-transport'],
      amount: '500',
      period: BudgetPeriod.MONTHLY,
    });
  });

  it('rejects the whole request if any category is income-only or not owned', async () => {
    await expect(
      useCase.execute({ ...command, categoryIds: ['cat-food', 'cat-salary'] }),
    ).rejects.toThrow("income categories can't be budgeted: Salary");

    await expect(
      useCase.execute({ ...command, categoryIds: ['cat-food', 'cat-unknown'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(budgets.createMany).not.toHaveBeenCalled();
  });

  it('rejects archived wallets and wallets the user does not own', async () => {
    accounts.findByIdForUser.mockResolvedValueOnce(makeAccount({ archivedAt: new Date() }));
    await expect(useCase.execute(command)).rejects.toBeInstanceOf(BadRequestException);

    accounts.findByIdForUser.mockResolvedValueOnce(null);
    await expect(useCase.execute(command)).rejects.toBeInstanceOf(NotFoundException);
    expect(budgets.createMany).not.toHaveBeenCalled();
  });

  it('rejects amounts beyond the wallet currency scale', async () => {
    await expect(useCase.execute({ ...command, amount: '10.999' })).rejects.toThrow(
      'USD allows 2',
    );
  });

  it('names categories already budgeted for the same wallet and period', async () => {
    budgets.findByCategories.mockResolvedValue([
      { accountId: 'acc-1', period: BudgetPeriod.MONTHLY, category: { name: 'Transport' } },
      // Same category on another wallet / period does not clash.
      { accountId: 'acc-2', period: BudgetPeriod.MONTHLY, category: { name: 'Food' } },
      { accountId: 'acc-1', period: BudgetPeriod.WEEKLY, category: { name: 'Food' } },
    ]);

    await expect(useCase.execute(command)).rejects.toThrow(
      'Already budgeted monthly on "Cash": Transport',
    );
    expect(budgets.createMany).not.toHaveBeenCalled();
  });

  it('maps a concurrent duplicate to 409', async () => {
    budgets.createMany.mockRejectedValue(new DuplicateBudgetScopeError());

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(ConflictException);
  });
});
