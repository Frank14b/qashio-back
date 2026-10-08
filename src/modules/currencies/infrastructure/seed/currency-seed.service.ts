import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SeedCurrenciesUseCase } from '../../application/seed-currencies.use-case';

/**
 * Idempotent currency seed on module init (upsert by code; tables come from
 * migrations). On by default; set SEED_CURRENCIES=false to skip.
 */
@Injectable()
export class CurrencySeedService implements OnModuleInit {
  private readonly logger = new Logger(CurrencySeedService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly seedCurrencies: SeedCurrenciesUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.shouldSeed()) {
      return;
    }
    this.logger.log('Seeding currencies (idempotent upsert by code)…');
    await this.seedCurrencies.execute();
  }

  private shouldSeed(): boolean {
    // Parsed to a boolean by the env schema (default true).
    return this.config.get<boolean>('SEED_CURRENCIES', true);
  }
}
