import { Inject, Injectable } from '@nestjs/common';
import {
  CURRENCY_REPOSITORY,
  CurrencyRepositoryPort,
} from '@/modules/currencies/domain/ports/currency.repository.port';
import { formatMoney } from '@/shared/money/money-input';
import { Account } from '../domain/entities/account.entity';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../domain/ports/account.repository.port';

export type AccountBalance = {
  /** Formatted to the account currency's decimal places */
  openingBalance: string;
  /** Formatted to the account currency's decimal places */
  balance: string;
};

const DEFAULT_DECIMAL_PLACES = 2;

/**
 * Derives current balances (never stored) for a set of wallets owned by one user.
 */
@Injectable()
export class GetAccountBalancesUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(CURRENCY_REPOSITORY) private readonly currencies: CurrencyRepositoryPort,
  ) {}

  async execute(userId: string, accounts: Account[]): Promise<Map<string, AccountBalance>> {
    const [balances, currencies] = await Promise.all([
      this.accounts.getBalances(
        userId,
        accounts.map((a) => a.id),
      ),
      this.currencies.findAll(),
    ]);
    const places = new Map(currencies.map((c) => [c.code, c.decimalPlaces]));

    return new Map(
      accounts.map((account) => {
        const decimalPlaces = places.get(account.currencyCode) ?? DEFAULT_DECIMAL_PLACES;
        const raw = balances.get(account.id) ?? account.openingBalance;
        return [
          account.id,
          {
            openingBalance: formatMoney(account.openingBalance, decimalPlaces),
            balance: formatMoney(raw, decimalPlaces),
          },
        ];
      }),
    );
  }
}
