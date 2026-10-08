import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  CURRENCY_REPOSITORY,
  CurrencyRepositoryPort,
} from '@/modules/currencies/domain/ports/currency.repository.port';
import { UNIT_OF_WORK, UnitOfWorkPort } from '@/shared/database/unit-of-work.port';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisherPort,
} from '@/shared/events/domain-event-publisher.port';
import { parseMoneyInput } from '@/shared/money/money-input';
import { Account } from '../domain/entities/account.entity';
import {
  ACCOUNT_CREATED_EVENT,
  AccountCreatedPayload,
} from '../domain/events/account.events';
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
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisherPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
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

    // Default switch, insert and account.created event commit together.
    return this.unitOfWork.run(async () => {
      if (isDefault) {
        await this.accounts.clearDefaultForUser(command.userId);
      }

      const account = await this.accounts.create({
        userId: command.userId,
        name,
        currencyCode,
        isDefault,
        openingBalance,
      });

      const payload: AccountCreatedPayload = {
        accountId: account.id,
        userId: account.userId,
        name: account.name,
        currencyCode: account.currencyCode,
        openingBalance: account.openingBalance,
      };
      await this.events.emit(ACCOUNT_CREATED_EVENT, payload);
      return account;
    });
  }
}
