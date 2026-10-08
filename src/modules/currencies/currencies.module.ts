import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListCurrenciesUseCase } from './application/list-currencies.use-case';
import { SeedCurrenciesUseCase } from './application/seed-currencies.use-case';
import { CURRENCY_REPOSITORY } from './domain/ports/currency.repository.port';
import { CurrencyOrmEntity } from './infrastructure/persistence/currency.orm-entity';
import { TypeOrmCurrencyRepository } from './infrastructure/persistence/typeorm-currency.repository';
import { CurrencySeedService } from './infrastructure/seed/currency-seed.service';
import { CurrenciesController } from './presentation/http/currencies.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CurrencyOrmEntity])],
  controllers: [CurrenciesController],
  providers: [
    ListCurrenciesUseCase,
    SeedCurrenciesUseCase,
    CurrencySeedService,
    {
      provide: CURRENCY_REPOSITORY,
      useClass: TypeOrmCurrencyRepository,
    },
  ],
  exports: [CURRENCY_REPOSITORY, SeedCurrenciesUseCase],
})
export class CurrenciesModule {}
