import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
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
import { TransactionType } from '../domain/transaction-type';

/**
 * Cross-aggregate checks shared by create/update: wallet ownership & state,
 * category ownership & kind, and amount scale for the wallet's currency.
 */
@Injectable()
export class TransactionRules {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepositoryPort,
    @Inject(CURRENCY_REPOSITORY) private readonly currencies: CurrencyRepositoryPort,
  ) {}

  /** Wallet that can receive new entries: owned by the user and not archived. */
  async requireActiveAccount(userId: string, accountId?: string): Promise<Account> {
    const account = accountId
      ? await this.accounts.findByIdForUser(accountId, userId)
      : await this.accounts.findDefaultForUser(userId);
    if (!account) {
      throw accountId
        ? new NotFoundException('Account not found')
        : new BadRequestException('accountId is required: no default wallet is set');
    }
    if (account.isArchived) {
      throw new BadRequestException('Cannot record transactions on an archived account');
    }
    return account;
  }

  async requireCompatibleCategory(
    userId: string,
    categoryId: string,
    type: TransactionType,
  ): Promise<Category> {
    const category = await this.categories.findByIdForUser(categoryId, userId);
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    if (category.kind !== CategoryKind.BOTH && category.kind !== (type as string)) {
      throw new BadRequestException(
        `Category "${category.name}" is for ${category.kind} and cannot be used for ${type}`,
      );
    }
    return category;
  }

  /** Positive amount within the currency's decimal places → normalized decimal string. */
  async parseAmount(amount: string | number, currencyCode: string): Promise<string> {
    const currency = await this.currencies.findByCode(currencyCode);
    if (!currency) {
      throw new BadRequestException(`Unknown currency: ${currencyCode}`);
    }
    return parseMoneyInput(amount, {
      field: 'amount',
      decimalPlaces: currency.decimalPlaces,
      currencyCode: currency.code,
      positive: true,
    });
  }
}

/** `undefined` keeps the current value; blank strings clear to `null`. */
export function cleanOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}
