import { Inject, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { formatMoney } from '@/shared/money/money-input';
import {
  TRANSACTION_REPOSITORY,
  TransactionRepositoryPort,
  TransactionSummaryQuery,
} from '../domain/ports/transaction.repository.port';

export type CurrencySummary = {
  currencyCode: string;
  income: string;
  expense: string;
  /** income − expense */
  net: string;
  count: number;
};

/** Completed income/expense totals per currency (amounts are never mixed across currencies). */
@Injectable()
export class SummarizeTransactionsUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepositoryPort,
  ) {}

  async execute(query: TransactionSummaryQuery): Promise<CurrencySummary[]> {
    const totals = await this.transactions.summarize(query);
    return totals.map((row) => ({
      currencyCode: row.currencyCode,
      income: formatMoney(row.income, row.decimalPlaces),
      expense: formatMoney(row.expense, row.decimalPlaces),
      net: new Decimal(row.income).minus(row.expense).toFixed(row.decimalPlaces),
      count: row.count,
    }));
  }
}
