import { Currency } from '../entities/currency.entity';

export const CURRENCY_REPOSITORY = Symbol('CURRENCY_REPOSITORY');

export type UpsertCurrencyInput = {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
};

export interface CurrencyRepositoryPort {
  findByCode(code: string): Promise<Currency | null>;
  findAll(): Promise<Currency[]>;
  count(): Promise<number>;
  upsertMany(inputs: UpsertCurrencyInput[]): Promise<void>;
}
