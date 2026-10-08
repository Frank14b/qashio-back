import { makeUser } from '@/test-utils/auth-fixtures';
import { BudgetPeriod } from '@/modules/budgets/domain/budget-period';
import { budgetThresholdReached } from './notification-content';
import { NotifyUserUseCase } from './notify-user.use-case';

describe('NotifyUserUseCase', () => {
  const notifications = { create: jest.fn() };
  const users = { findById: jest.fn() };
  const emails = { send: jest.fn() };
  const useCase = new NotifyUserUseCase(notifications as never, users as never, emails as never);

  const alert = budgetThresholdReached({
    userId: 'user-1',
    budgetId: 'budget-1',
    categoryName: 'Food',
    currencyCode: 'USD',
    period: BudgetPeriod.MONTHLY,
    threshold: 80,
    amount: '500.0000',
    spent: '412.3000',
    periodStart: '2026-10-01T00:00:00.000Z',
    periodEnd: '2026-11-01T00:00:00.000Z',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    users.findById.mockResolvedValue(makeUser());
  });

  it('stores the in-app notification and emails budget alerts', async () => {
    await useCase.execute(alert);

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        title: 'Budget at 80%: Food',
        data: { budgetId: 'budget-1' },
      }),
    );
    expect(emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        subject: 'Budget at 80%: Food',
        // Intl separates the code and amount with a non-breaking space.
        text: expect.stringMatching(/USD\s412\.30 of your USD\s500\.00 Food budget this month/),
      }),
    );
  });

  it('keeps the notification when the email fails', async () => {
    emails.send.mockRejectedValue(new Error('SMTP down'));

    await expect(useCase.execute(alert)).resolves.toBeUndefined();
    expect(notifications.create).toHaveBeenCalledTimes(1);
  });

  it('does not email notifications that are in-app only', async () => {
    await useCase.execute({ ...alert, email: false });

    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(users.findById).not.toHaveBeenCalled();
    expect(emails.send).not.toHaveBeenCalled();
  });
});
