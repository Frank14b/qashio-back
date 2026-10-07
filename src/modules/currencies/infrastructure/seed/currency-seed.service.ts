import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SeedCurrenciesUseCase } from '../../application/seed-currencies.use-case';

/**
 * Idempotent currency seed on module init when enabled.
 * Runs when SEED_CURRENCIES=true, or when TYPEORM_SYNC=true (dev convenience).
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
    const explicit = this.config.get<string>('SEED_CURRENCIES');
    if (explicit === 'true') {
      return true;
    }
    if (explicit === 'false') {
      return false;
    }
    return this.config.get<string>('TYPEORM_SYNC', 'false') === 'true';
  }
}
