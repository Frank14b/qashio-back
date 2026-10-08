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
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisherPort,
} from '@/shared/events/domain-event-publisher.port';
import { parseMoneyInput } from '@/shared/money/money-input';
import { Account } from '../domain/entities/account.entity';
import {
  ACCOUNT_UPDATED_EVENT,
  AccountUpdatedPayload,
} from '../domain/events/account.events';
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
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisherPort,
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

    const updated = await this.accounts.update(command.accountId, {
      name: command.name?.trim(),
      isDefault: command.isDefault,
      archivedAt,
      openingBalance,
    });

    const payload: AccountUpdatedPayload = {
      accountId: updated.id,
      userId: updated.userId,
      name: updated.name,
      currencyCode: updated.currencyCode,
      changes: {
        ...(updated.name !== existing.name && { name: { from: existing.name, to: updated.name } }),
        ...(updated.isDefault !== existing.isDefault && { isDefault: updated.isDefault }),
        ...(updated.isArchived !== existing.isArchived && { archived: updated.isArchived }),
        ...(openingBalance !== undefined &&
          updated.openingBalance !== existing.openingBalance && {
            openingBalance: { from: existing.openingBalance, to: updated.openingBalance },
          }),
      },
    };
    if (Object.keys(payload.changes).length > 0) {
      this.events.emit(ACCOUNT_UPDATED_EVENT, payload);
    }
    return updated;
  }
}
