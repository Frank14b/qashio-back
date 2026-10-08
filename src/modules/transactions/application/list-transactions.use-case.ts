import { Inject, Injectable } from '@nestjs/common';
import {
  ListTransactionsQuery,
  TRANSACTION_REPOSITORY,
  TransactionPage,
  TransactionRepositoryPort,
} from '../domain/ports/transaction.repository.port';

export type ListTransactionsCommand = Omit<
  ListTransactionsQuery,
  'sortBy' | 'sortOrder' | 'page' | 'limit'
> &
  Partial<Pick<ListTransactionsQuery, 'sortBy' | 'sortOrder' | 'page' | 'limit'>>;

export const DEFAULT_TRANSACTIONS_PAGE_SIZE = 10;

@Injectable()
export class ListTransactionsUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepositoryPort,
  ) {}

  execute(command: ListTransactionsCommand): Promise<TransactionPage> {
    return this.transactions.findMany({
      ...command,
      search: command.search?.trim() || undefined,
      sortBy: command.sortBy ?? 'occurredAt',
      sortOrder: command.sortOrder ?? 'DESC',
      page: command.page ?? 1,
      limit: command.limit ?? DEFAULT_TRANSACTIONS_PAGE_SIZE,
    });
  }
}
