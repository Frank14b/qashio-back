import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  CURRENCY_REPOSITORY,
  CurrencyRepositoryPort,
} from '@/modules/currencies/domain/ports/currency.repository.port';
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
};

@Injectable()
export class CreateAccountUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(CURRENCY_REPOSITORY) private readonly currencies: CurrencyRepositoryPort,
  ) {}

  async execute(command: CreateAccountCommand): Promise<Account> {
    const name = command.name.trim();
    if (!name) {
      throw new BadRequestException('Account name is required');
    }

    const currencyCode = command.currencyCode.trim().toUpperCase();
    const currency = await this.currencies.findByCode(currencyCode);
    if (!currency) {
      throw new BadRequestException(`Unknown currency: ${currencyCode}`);
    }

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
    });
  }
}
