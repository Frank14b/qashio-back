import { TransactionSnapshot } from '@/modules/transactions/domain/events/transaction.events';
import { TransactionStatus } from '@/modules/transactions/domain/transaction-status';
import { TransactionType } from '@/modules/transactions/domain/transaction-type';
import { BudgetPeriod } from '../domain/budget-period';
import { Budget } from '../domain/entities/budget.entity';
import { BUDGET_THRESHOLD_REACHED_EVENT } from '../domain/events/budget.events';
import { EvaluateBudgetThresholdsUseCase } from './evaluate-budget-thresholds.use-case';

const periodStart = new Date('2026-10-01T00:00:00.000Z');
const periodEnd = new Date('2026-11-01T00:00:00.000Z');

const budget = (overrides: Partial<ConstructorParameters<typeof Budget>[0]> = {}) =>
  new Budget({
    id: 'budget-1',
    userId: 'user-1',
    categoryId: 'cat-food',
    accountId: 'acc-1',
    amount: '500.0000',
    period: BudgetPeriod.MONTHLY,
    createdAt: periodStart,
    updatedAt: periodStart,
    category: { id: 'cat-food', name: 'Food' },
    account: { id: 'acc-1', name: 'Cash', currencyCode: 'USD', decimalPlaces: 2 },
    ...overrides,
  });

const expense = (overrides: Partial<TransactionSnapshot> = {}): TransactionSnapshot => ({
  id: 'txn-1',
  reference: 'TXN-261007-ABC123',
  userId: 'user-1',
  accountId: 'acc-1',
  categoryId: 'cat-food',
  categoryName: 'Food',
  type: TransactionType.EXPENSE,
  amount: '50.0000',
  currencyCode: 'USD',
  status: TransactionStatus.COMPLETED,
  counterparty: 'Carrefour',
  occurredAt: '2026-10-07T09:00:00.000Z',
  ...overrides,
});

describe('EvaluateBudgetThresholdsUseCase', () => {
  const budgets = { findByCategories: jest.fn(), getUsage: jest.fn() };
  const events = { emit: jest.fn() };
  const useCase = new EvaluateBudgetThresholdsUseCase(budgets as never, events as never);

  /** `spent` is the usage AFTER the change, as the DB reports it post-commit. */
  const givenUsage = (spent: string, b = budget()) => {
    budgets.findByCategories.mockResolvedValue([b]);
    budgets.getUsage.mockResolvedValue(new Map([[b.id, { spent, periodStart, periodEnd }]]));
  };

  const emitted = () => events.emit.mock.calls.map(([, payload]) => payload.threshold);

  beforeEach(() => jest.clearAllMocks());

  it('alerts at 80% when an expense crosses it', async () => {
    givenUsage('420'); // 370 → 420 of 500
    await useCase.execute({ userId: 'user-1', before: null, after: expense() });

    expect(events.emit).toHaveBeenCalledWith(
      BUDGET_THRESHOLD_REACHED_EVENT,
      expect.objectContaining({ budgetId: 'budget-1', threshold: 80, spent: '420' }),
    );
  });

  it('keys the alert on the source event so a retried evaluation records it once', async () => {
    givenUsage('420');
    await useCase.execute({
      userId: 'user-1',
      before: null,
      after: expense(),
      sourceEventId: 'evt-1',
    });

    expect(events.emit).toHaveBeenCalledWith(
      BUDGET_THRESHOLD_REACHED_EVENT,
      expect.objectContaining({ threshold: 80 }),
      { dedupeKey: 'evt-1:budget-1:80' },
    );
  });

  it('alerts only the highest threshold when one expense crosses both', async () => {
    givenUsage('510'); // 300 → 510 with a 210 expense
    await useCase.execute({ userId: 'user-1', before: null, after: expense({ amount: '210' }) });

    expect(emitted()).toEqual([100]);
  });

  it('stays quiet once a threshold was already passed', async () => {
    givenUsage('560'); // 510 → 560: already exceeded before this expense
    await useCase.execute({ userId: 'user-1', before: null, after: expense() });

    expect(events.emit).not.toHaveBeenCalled();
  });

  it('does not alert when spending goes down (delete)', async () => {
    givenUsage('380'); // 430 → 380
    await useCase.execute({ userId: 'user-1', before: expense(), after: null });

    expect(events.emit).not.toHaveBeenCalled();
  });

  it('uses the delta on update (40 → 90 crosses 100%)', async () => {
    givenUsage('520'); // 470 → 520
    await useCase.execute({
      userId: 'user-1',
      before: expense({ amount: '40' }),
      after: expense({ amount: '90' }),
    });

    expect(emitted()).toEqual([100]);
  });

  it.each([
    ['an expense on another wallet', expense({ accountId: 'acc-2' })],
    [
      'a back-dated expense outside the current period',
      expense({ occurredAt: '2026-09-30T23:00:00.000Z' }),
    ],
    ['a pending expense', expense({ status: TransactionStatus.PENDING })],
  ])('ignores %s', async (_label, snapshot) => {
    givenUsage('600');
    await useCase.execute({ userId: 'user-1', before: null, after: snapshot });

    expect(events.emit).not.toHaveBeenCalled();
  });

  it('skips budget lookups for income', async () => {
    await useCase.execute({
      userId: 'user-1',
      before: null,
      after: expense({ type: TransactionType.INCOME }),
    });

    expect(budgets.findByCategories).not.toHaveBeenCalled();
  });
});
