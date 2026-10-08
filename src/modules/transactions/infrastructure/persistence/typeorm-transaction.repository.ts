import { InjectTransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm';
import { TypeOrmTransactionHost } from '@/shared/database/transaction-host';
import { CategoryKind } from '@/modules/categories/domain/category-kind';
import { Transaction } from '../../domain/entities/transaction.entity';
import {
  CreateTransactionInput,
  CurrencyTotals,
  DuplicateIdempotencyKeyError,
  DuplicateTransactionReferenceError,
  ListTransactionsQuery,
  PossibleDuplicateQuery,
  TransactionPage,
  TransactionRepositoryPort,
  TransactionSortField,
  TransactionSummaryQuery,
  UpdateTransactionInput,
} from '../../domain/ports/transaction.repository.port';
import { TransactionStatus } from '../../domain/transaction-status';
import { TransactionType } from '../../domain/transaction-type';
import { TransactionOrmEntity } from './transaction.orm-entity';

const PG_UNIQUE_VIOLATION = '23505';
const REFERENCE_CONSTRAINT = 'UQ_transactions_reference';
const IDEMPOTENCY_KEY_CONSTRAINT = 'UQ_transactions_user_idempotency_key';
const DEFAULT_DECIMAL_PLACES = 2;

const SORT_COLUMNS: Record<TransactionSortField, string> = {
  occurredAt: 't.occurredAt',
  amount: 't.amount',
  createdAt: 't.createdAt',
  reference: 't.reference',
  counterparty: 't.counterparty',
};

@Injectable()
export class TypeOrmTransactionRepository implements TransactionRepositoryPort {
  constructor(@InjectTransactionHost() private readonly txHost: TypeOrmTransactionHost) {}

  /** Joins the caller's UnitOfWork transaction when there is one. */
  private get transactions(): Repository<TransactionOrmEntity> {
    return this.txHost.tx.getRepository(TransactionOrmEntity);
  }

  async create(input: CreateTransactionInput): Promise<Transaction> {
    let id: string;
    try {
      const result = await this.transactions.insert({
        reference: input.reference,
        idempotencyKey: input.idempotencyKey,
        userId: input.userId,
        accountId: input.accountId,
        categoryId: input.categoryId,
        type: input.type,
        amount: input.amount,
        status: input.status,
        counterparty: input.counterparty,
        narration: input.narration,
        occurredAt: input.occurredAt,
      });
      id = (result.identifiers[0] as { id: string }).id;
    } catch (error) {
      const constraint = this.uniqueViolationConstraint(error);
      if (constraint === REFERENCE_CONSTRAINT) {
        throw new DuplicateTransactionReferenceError(input.reference);
      }
      if (constraint === IDEMPOTENCY_KEY_CONSTRAINT) {
        throw new DuplicateIdempotencyKeyError(input.idempotencyKey);
      }
      throw error;
    }
    return this.findByIdOrFail(id);
  }

  async findByIdForUser(id: string, userId: string): Promise<Transaction | null> {
    const row = await this.baseQuery()
      .where('t.id = :id', { id })
      .andWhere('t.user_id = :userId', { userId })
      .getOne();
    return row ? this.toDomain(row) : null;
  }

  async findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<Transaction | null> {
    const row = await this.baseQuery()
      .where('t.user_id = :userId', { userId })
      .andWhere('t.idempotency_key = :idempotencyKey', { idempotencyKey })
      .getOne();
    return row ? this.toDomain(row) : null;
  }

  async findPossibleDuplicate(query: PossibleDuplicateQuery): Promise<Transaction | null> {
    const qb = this.baseQuery()
      .where('t.user_id = :userId', { userId: query.userId })
      .andWhere('t.account_id = :accountId', { accountId: query.accountId })
      .andWhere('t.category_id = :categoryId', { categoryId: query.categoryId })
      .andWhere('t.type = :type', { type: query.type })
      .andWhere('t.amount = :amount', { amount: query.amount })
      .andWhere('t.created_at >= :createdSince', { createdSince: query.createdSince })
      .andWhere('t.idempotency_key IS DISTINCT FROM :excludeKey', {
        excludeKey: query.excludeIdempotencyKey,
      });
    if (query.counterparty) {
      qb.andWhere('LOWER(t.counterparty) = LOWER(:counterparty)', {
        counterparty: query.counterparty,
      });
    }
    const row = await qb.orderBy('t.created_at', 'DESC').getOne();
    return row ? this.toDomain(row) : null;
  }

  async findMany(query: ListTransactionsQuery): Promise<TransactionPage> {
    const qb = this.baseQuery().where('t.user_id = :userId', { userId: query.userId });

    if (query.accountId) {
      qb.andWhere('t.account_id = :accountId', { accountId: query.accountId });
    }
    if (query.categoryId) {
      qb.andWhere('t.category_id = :categoryId', { categoryId: query.categoryId });
    }
    if (query.type) {
      qb.andWhere('t.type = :type', { type: query.type });
    }
    if (query.status) {
      qb.andWhere('t.status = :status', { status: query.status });
    }
    this.applyDateRange(qb, query.from, query.to);
    if (query.search) {
      // Escape LIKE wildcards so user input is matched literally (no TypeORM helper for this).
      const term = `%${query.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      qb.andWhere(
        '(t.reference ILIKE :term OR t.counterparty ILIKE :term OR t.narration ILIKE :term)',
        { term },
      );
    }

    // NULLS LAST keeps rows without a counterparty at the end in both directions;
    // the id tiebreaker keeps pagination stable when sort keys tie.
    qb.orderBy(SORT_COLUMNS[query.sortBy], query.sortOrder, 'NULLS LAST')
      .addOrderBy('t.id', query.sortOrder)
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map((row) => this.toDomain(row)), total };
  }

  async update(id: string, input: UpdateTransactionInput): Promise<Transaction> {
    const patch: Partial<TransactionOrmEntity> = {};
    if (input.accountId !== undefined) patch.accountId = input.accountId;
    if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
    if (input.type !== undefined) patch.type = input.type;
    if (input.amount !== undefined) patch.amount = input.amount;
    if (input.counterparty !== undefined) patch.counterparty = input.counterparty;
    if (input.narration !== undefined) patch.narration = input.narration;
    if (input.occurredAt !== undefined) patch.occurredAt = input.occurredAt;

    if (Object.keys(patch).length > 0) {
      await this.transactions.update({ id }, patch);
    }
    return this.findByIdOrFail(id);
  }

  async delete(id: string): Promise<void> {
    await this.transactions.delete({ id });
  }

  async summarize(query: TransactionSummaryQuery): Promise<CurrencyTotals[]> {
    const qb = this.transactions
      .createQueryBuilder('t')
      .innerJoin('t.account', 'account')
      .innerJoin('account.currency', 'currency')
      .select('currency.code', 'currencyCode')
      .addSelect('currency.decimal_places', 'decimalPlaces')
      .addSelect('COALESCE(SUM(t.amount) FILTER (WHERE t.type = :income), 0)', 'income')
      .addSelect('COALESCE(SUM(t.amount) FILTER (WHERE t.type = :expense), 0)', 'expense')
      .addSelect('COUNT(*)', 'count')
      .where('t.user_id = :userId', { userId: query.userId })
      .andWhere('t.status = :status', { status: TransactionStatus.COMPLETED })
      .setParameters({ income: TransactionType.INCOME, expense: TransactionType.EXPENSE });
    if (query.accountId) {
      qb.andWhere('t.account_id = :accountId', { accountId: query.accountId });
    }
    this.applyDateRange(qb, query.from, query.to);

    const rows = await qb
      .groupBy('currency.code')
      .addGroupBy('currency.decimal_places')
      .orderBy('currency.code', 'ASC')
      .getRawMany<{
        currencyCode: string;
        decimalPlaces: number | string;
        income: string;
        expense: string;
        count: string;
      }>();

    return rows.map((row) => ({
      currencyCode: row.currencyCode.trim(),
      decimalPlaces: Number(row.decimalPlaces),
      income: String(row.income),
      expense: String(row.expense),
      count: Number(row.count),
    }));
  }

  private baseQuery(): SelectQueryBuilder<TransactionOrmEntity> {
    return this.transactions
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.account', 'account')
      .leftJoinAndSelect('account.currency', 'currency')
      .innerJoinAndSelect('t.category', 'category');
  }

  private applyDateRange(
    qb: SelectQueryBuilder<TransactionOrmEntity>,
    from?: Date,
    to?: Date,
  ): void {
    if (from) {
      qb.andWhere('t.occurred_at >= :from', { from });
    }
    if (to) {
      qb.andWhere('t.occurred_at <= :to', { to });
    }
  }

  private async findByIdOrFail(id: string): Promise<Transaction> {
    const row = await this.baseQuery().where('t.id = :id', { id }).getOne();
    if (!row) {
      throw new Error(`Transaction ${id} not found`);
    }
    return this.toDomain(row);
  }

  private uniqueViolationConstraint(error: unknown): string | undefined {
    if (!(error instanceof QueryFailedError)) {
      return undefined;
    }
    const driverError = error.driverError as { code?: string; constraint?: string };
    return driverError.code === PG_UNIQUE_VIOLATION ? driverError.constraint : undefined;
  }

  private toDomain(row: TransactionOrmEntity): Transaction {
    const { account, category } = row;
    if (!account || !category) {
      throw new Error(`Transaction ${row.id} loaded without account/category`);
    }
    return new Transaction({
      id: row.id,
      reference: row.reference,
      userId: row.userId,
      accountId: row.accountId,
      categoryId: row.categoryId,
      type: row.type as TransactionType,
      amount: String(row.amount),
      status: row.status as TransactionStatus,
      counterparty: row.counterparty,
      narration: row.narration,
      occurredAt: row.occurredAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      account: {
        id: account.id,
        name: account.name,
        currencyCode: account.currencyCode.trim(),
        decimalPlaces: account.currency?.decimalPlaces ?? DEFAULT_DECIMAL_PLACES,
      },
      category: {
        id: category.id,
        name: category.name,
        kind: category.kind as CategoryKind,
      },
    });
  }
}
