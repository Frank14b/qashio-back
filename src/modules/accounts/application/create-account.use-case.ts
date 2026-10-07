import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  CURRENCY_REPOSITORY,
  CurrencyRepositoryPort,
} from '@/modules/currencies/domain/ports/currency.repository.port';
import { parseMoneyInput } from '@/shared/money/money-input';
import { Account } from '../domain/entities/account.entity';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../domain/ports/account.repository.port';

export type CreateAccountCommand = {
  userId: string;
  name: string;
  currencyCode: string;
  isDefault?: boolean;
  openingBalance?: string | number;
};

@Injectable()
export class CreateAccountUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(CURRENCY_REPOSITORY) private readonly currencies: CurrencyRepositoryPort,
  ) {}

  /** Rejecting a blank name is CreateAccountRequestDto's job; here we only canonicalize. */
  async execute(command: CreateAccountCommand): Promise<Account> {
    const name = command.name.trim();
    // Canonicalize the code: currency lookups are case-sensitive.
    const currencyCode = command.currencyCode.trim().toUpperCase();
    const currency = await this.currencies.findByCode(currencyCode);
    if (!currency) {
      throw new BadRequestException(`Unknown currency: ${currencyCode}`);
    }

    // Omitted → repository default (0).
    const openingBalance =
      command.openingBalance !== undefined
        ? parseMoneyInput(command.openingBalance, {
            field: 'openingBalance',
            decimalPlaces: currency.decimalPlaces,
            currencyCode,
          })
        : undefined;

    const activeCount = await this.accounts.countActiveForUser(command.userId);
    const isDefault = command.isDefault === true || activeCount === 0;

    if (isDefault) {
      await this.accounts.clearDefaultForUser(command.userId);
    }

    return this.accounts.create({
      userId: command.userId,
      name,
      currencyCode,
      isDefault,
      openingBalance,
    });
  }
}
