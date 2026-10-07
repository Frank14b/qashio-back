import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

export type UpdateAccountCommand = {
  userId: string;
  accountId: string;
  name?: string;
  isDefault?: boolean;
  archive?: boolean;
  openingBalance?: string | number;
};

@Injectable()
export class UpdateAccountUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(CURRENCY_REPOSITORY) private readonly currencies: CurrencyRepositoryPort,
  ) {}

  async execute(command: UpdateAccountCommand): Promise<Account> {
    const existing = await this.accounts.findByIdForUser(
      command.accountId,
      command.userId,
    );
    if (!existing) {
      throw new NotFoundException('Account not found');
    }

    // Input shape (at least one field, non-empty name, not archive + isDefault)
    // is validated by UpdateAccountRequestDto; only state-dependent rules live here.
    if (command.isDefault === true && existing.isArchived && command.archive !== false) {
      throw new BadRequestException('Cannot set an archived account as default');
    }

    let openingBalance: string | undefined;
    if (command.openingBalance !== undefined) {
      const currency = await this.currencies.findByCode(existing.currencyCode);
      if (!currency) {
        throw new BadRequestException(`Unknown currency: ${existing.currencyCode}`);
      }
      openingBalance = parseMoneyInput(command.openingBalance, {
        field: 'openingBalance',
        decimalPlaces: currency.decimalPlaces,
        currencyCode: currency.code,
      });
    }

    if (command.isDefault === true) {
      await this.accounts.clearDefaultForUser(command.userId);
    }

    let archivedAt: Date | null | undefined;
    if (command.archive === true) {
      archivedAt = existing.archivedAt ?? new Date();
    } else if (command.archive === false) {
      archivedAt = null;
    }

    return this.accounts.update(command.accountId, {
      name: command.name?.trim(),
      isDefault: command.isDefault,
      archivedAt,
      openingBalance,
    });
  }
}
