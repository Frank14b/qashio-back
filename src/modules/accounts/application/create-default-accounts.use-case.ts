import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import {
  CURRENCY_REPOSITORY,
  CurrencyRepositoryPort,
} from '@/modules/currencies/domain/ports/currency.repository.port';
import { Account } from '../domain/entities/account.entity';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../domain/ports/account.repository.port';
import { DEFAULT_ACCOUNT_SEEDS } from './default-accounts';

export type CreateDefaultAccountsCommand = {
  userId: string;
};

@Injectable()
export class CreateDefaultAccountsUseCase {
  private readonly logger = new Logger(CreateDefaultAccountsUseCase.name);

  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(CURRENCY_REPOSITORY) private readonly currencies: CurrencyRepositoryPort,
  ) {}

  /**
   * Idempotent: only inserts default names the user does not already have.
   */
  async execute(command: CreateDefaultAccountsCommand): Promise<Account[]> {
    const existingNames = await this.accounts.findNamesByUserId(command.userId);
    const missing = DEFAULT_ACCOUNT_SEEDS.filter((seed) => !existingNames.has(seed.name));

    if (missing.length === 0) {
      this.logger.debug(
        `Default accounts already present for user ${command.userId}; skipping`,
      );
      return [];
    }

    const currencyCodes = [...new Set(missing.map((seed) => seed.currencyCode.toUpperCase()))];
    for (const code of currencyCodes) {
      const currency = await this.currencies.findByCode(code);
      if (!currency) {
        throw new BadRequestException(`Unknown currency for default accounts: ${code}`);
      }
    }

    if (missing.some((seed) => seed.isDefault)) {
      await this.accounts.clearDefaultForUser(command.userId);
    }

    const created = await this.accounts.createMany(
      missing.map((seed) => ({
        userId: command.userId,
        name: seed.name,
        currencyCode: seed.currencyCode.toUpperCase(),
        isDefault: seed.isDefault,
      })),
    );

    this.logger.log(`Created ${created.length} default accounts for user ${command.userId}`);
    return created;
  }
}
