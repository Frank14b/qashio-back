import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Currency } from '../../domain/entities/currency.entity';
import {
  CurrencyRepositoryPort,
  UpsertCurrencyInput,
} from '../../domain/ports/currency.repository.port';
import { CurrencyOrmEntity } from './currency.orm-entity';

@Injectable()
export class TypeOrmCurrencyRepository implements CurrencyRepositoryPort {
  constructor(
    @InjectRepository(CurrencyOrmEntity)
    private readonly currencies: Repository<CurrencyOrmEntity>,
  ) {}

  async findByCode(code: string): Promise<Currency | null> {
    const row = await this.currencies.findOne({
      where: { code: code.toUpperCase() },
    });
    return row ? this.toDomain(row) : null;
  }

  async findAll(): Promise<Currency[]> {
    const rows = await this.currencies.find({ order: { code: 'ASC' } });
    return rows.map((row) => this.toDomain(row));
  }

  async count(): Promise<number> {
    return this.currencies.count();
  }

  async upsertMany(inputs: UpsertCurrencyInput[]): Promise<void> {
    if (inputs.length === 0) {
      return;
    }
    await this.currencies.upsert(
      inputs.map((input) => ({
        code: input.code.toUpperCase(),
        name: input.name,
        symbol: input.symbol,
        decimalPlaces: input.decimalPlaces,
      })),
      ['code'],
    );
  }

  private toDomain(row: CurrencyOrmEntity): Currency {
    return new Currency({
      code: row.code.trim(),
      name: row.name,
      symbol: row.symbol,
      decimalPlaces: row.decimalPlaces,
    });
  }
}
