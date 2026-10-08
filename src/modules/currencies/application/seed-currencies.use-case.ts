import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CURRENCY_REPOSITORY,
  CurrencyRepositoryPort,
} from '../domain/ports/currency.repository.port';
import { CURRENCY_SEED_DATA } from '../infrastructure/seed/currency.seed-data';

@Injectable()
export class SeedCurrenciesUseCase {
  private readonly logger = new Logger(SeedCurrenciesUseCase.name);

  constructor(
    @Inject(CURRENCY_REPOSITORY) private readonly currencies: CurrencyRepositoryPort,
  ) {}

  async execute(): Promise<{ upserted: number }> {
    await this.currencies.upsertMany(CURRENCY_SEED_DATA);
    this.logger.log(`Upserted ${CURRENCY_SEED_DATA.length} currencies`);
    return { upserted: CURRENCY_SEED_DATA.length };
  }
}
