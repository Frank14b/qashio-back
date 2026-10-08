import type {
  AccountCreatedPayload,
  AccountUpdatedPayload,
} from '@/modules/accounts/domain/events/account.events';
import type { BudgetThresholdReachedPayload } from '@/modules/budgets/domain/events/budget.events';
import type { TransactionSnapshot } from '@/modules/transactions/domain/events/transaction.events';
import { NotificationType } from '../domain/notification-type';
import type { CreateNotificationInput } from '../domain/ports/notification.repository.port';

/** What to store in-app, plus whether it also goes out by email. */
export type NotificationDraft = CreateNotificationInput & { email: boolean };

// Built-in Intl formats numeric strings exactly, with the currency's own decimals.
const money = (amount: string, currency: string, signDisplay: 'auto' | 'always' = 'auto') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    signDisplay,
  }).format(amount as Intl.StringNumericLiteral);

const signed = (t: TransactionSnapshot) =>
  money(t.type === 'expense' ? `-${t.amount}` : t.amount, t.currencyCode, 'always');

const describe = (t: TransactionSnapshot) =>
  [signed(t), t.counterparty, t.categoryName].filter(Boolean).join(' · ');

const PERIOD_LABEL = { weekly: 'this week', monthly: 'this month', yearly: 'this year' };

export function transactionCreated(t: TransactionSnapshot): NotificationDraft {
  return {
    userId: t.userId,
    type: NotificationType.TRANSACTION_CREATED,
    title: t.type === 'expense' ? 'Expense recorded' : 'Income recorded',
    message: describe(t),
    data: { transactionId: t.id },
    email: false,
  };
}

export function transactionUpdated(current: TransactionSnapshot): NotificationDraft {
  return {
    userId: current.userId,
    type: NotificationType.TRANSACTION_UPDATED,
    title: 'Transaction updated',
    message: `${current.reference} is now ${describe(current)}`,
    data: { transactionId: current.id },
    email: false,
  };
}

export function transactionDeleted(t: TransactionSnapshot): NotificationDraft {
  return {
    userId: t.userId,
    type: NotificationType.TRANSACTION_DELETED,
    title: 'Transaction deleted',
    message: `${t.reference} (${describe(t)}) was deleted`,
    data: {},
    email: false,
  };
}

export function budgetThresholdReached(b: BudgetThresholdReachedPayload): NotificationDraft {
  const exceeded = b.threshold >= 100;
  return {
    userId: b.userId,
    type: NotificationType.BUDGET_THRESHOLD_REACHED,
    title: exceeded ? `Budget exceeded: ${b.categoryName}` : `Budget at ${b.threshold}%: ${b.categoryName}`,
    message: `You've spent ${money(b.spent, b.currencyCode)} of your ${money(b.amount, b.currencyCode)} ${b.categoryName} budget ${PERIOD_LABEL[b.period]}.`,
    data: { budgetId: b.budgetId },
    email: true,
  };
}

export function accountCreated(a: AccountCreatedPayload): NotificationDraft {
  return {
    userId: a.userId,
    type: NotificationType.ACCOUNT_CREATED,
    title: 'Wallet created',
    message: `"${a.name}" (${a.currencyCode}) was added with an opening balance of ${money(a.openingBalance, a.currencyCode)}.`,
    data: { accountId: a.accountId },
    email: false,
  };
}

export function accountUpdated(a: AccountUpdatedPayload): NotificationDraft {
  const { changes } = a;
  const parts = [
    changes.name && `renamed from "${changes.name.from}"`,
    changes.archived === true && 'archived',
    changes.archived === false && 'restored',
    changes.isDefault === true && 'set as default',
    changes.isDefault === false && 'no longer the default',
    changes.openingBalance &&
      `opening balance changed to ${money(changes.openingBalance.to, a.currencyCode)}`,
  ].filter((part): part is string => Boolean(part));
  return {
    userId: a.userId,
    type: NotificationType.ACCOUNT_UPDATED,
    title: changes.archived === true ? 'Wallet archived' : 'Wallet updated',
    message: `"${a.name}": ${parts.join(', ')}.`,
    data: { accountId: a.accountId },
    email: false,
  };
}
