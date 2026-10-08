import { Inject, Injectable } from '@nestjs/common';
import { Currency } from '../domain/entities/currency.entity';
import {
  CURRENCY_REPOSITORY,
  CurrencyRepositoryPort,
} from '../domain/ports/currency.repository.port';

@Injectable()
export class ListCurrenciesUseCase {
  constructor(
    @Inject(CURRENCY_REPOSITORY) private readonly currencies: CurrencyRepositoryPort,
  ) {}

  execute(): Promise<Currency[]> {
    return this.currencies.findAll();
  }
}