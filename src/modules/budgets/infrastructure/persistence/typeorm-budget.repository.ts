import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm';
import { BudgetPeriod } from '../../domain/budget-period';
import { Budget, BudgetUsage } from '../../domain/entities/budget.entity';
import {
  BudgetRepositoryPort,
  CreateBudgetsInput,
  DuplicateBudgetScopeError,
  UpdateBudgetInput,
} from '../../domain/ports/budget.repository.port';
import { BudgetOrmEntity } from './budget.orm-entity';

const PG_UNIQUE_VIOLATION = '23505';

/**
 * Current-period spending per budget: completed expenses in the budget's
 * category on its wallet. Period bounds come from Postgres `date_trunc`
 * (ISO weeks start Monday) in the DB session time zone.
 */
const USAGE_SQL = `
  SELECT b.id,
         p.start AS period_start,
         p.start + ('1 ' || p.unit)::interval AS period_end,
         COALESCE(SUM(t.amount), 0) AS spent
  FROM budgets b
  CROSS JOIN LATERAL (
    SELECT u.unit, date_trunc(u.unit, now()) AS start
    FROM (SELECT CASE b.period WHEN 'weekly' THEN 'week'
                               WHEN 'monthly' THEN 'month'
                               ELSE 'year' END AS unit) u
  ) p
  LEFT JOIN transactions t
    ON t.account_id = b.account_id
   AND t.category_id = b.category_id
   AND t.type = 'expense'
   AND t.status = 'completed'
   AND t.occurred_at >= p.start
   AND t.occurred_at < p.start + ('1 ' || p.unit)::interval
  WHERE b.id = ANY($1)
  GROUP BY b.id, p.start, p.unit
`;

@Injectable()
export class TypeOrmBudgetRepository implements BudgetRepositoryPort {
  constructor(
    @InjectRepository(BudgetOrmEntity)
    private readonly budgets: Repository<BudgetOrmEntity>,
  ) {}

  async createMany(input: CreateBudgetsInput): Promise<Budget[]> {
    let ids: string[];
    try {
      // A single multi-row INSERT is atomic: every budget is created or none.
      const result = await this.budgets.insert(
        input.categoryIds.map((categoryId) => ({
          userId: input.userId,
          accountId: input.accountId,
          categoryId,
          amount: input.amount,
          period: input.period,
        })),
      );
      ids = result.identifiers.map((row) => (row as { id: string }).id);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new DuplicateBudgetScopeError();
      }
      throw error;
    }
    const rows = await this.baseQuery().where({ id: In(ids) }).getMany();
    return rows.map((row) => this.toDomain(row));
  }

  async findByIdForUser(id: string, userId: string): Promise<Budget | null> {
    const row = await this.baseQuery()
      .where('b.id = :id', { id })
      .andWhere('b.user_id = :userId', { userId })
      .getOne();
    return row ? this.toDomain(row) : null;
  }

  async findByUser(userId: string): Promise<Budget[]> {
    const rows = await this.baseQuery()
      .where('b.user_id = :userId', { userId })
      .orderBy('account.name', 'ASC')
      .addOrderBy('category.name', 'ASC')
      .getMany();
    return rows.map((row) => this.toDomain(row));
  }

  async findByCategories(userId: string, categoryIds: string[]): Promise<Budget[]> {
    if (categoryIds.length === 0) {
      return [];
    }
    const rows = await this.baseQuery()
      .where('b.user_id = :userId', { userId })
      .andWhere({ categoryId: In(categoryIds) })
      .getMany();
    return rows.map((row) => this.toDomain(row));
  }

  async update(id: string, input: UpdateBudgetInput): Promise<Budget> {
    const patch: Partial<BudgetOrmEntity> = {};
    if (input.amount !== undefined) patch.amount = input.amount;
    if (input.period !== undefined) patch.period = input.period;
    if (Object.keys(patch).length > 0) {
      try {
        await this.budgets.update({ id }, patch);
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          throw new DuplicateBudgetScopeError();
        }
        throw error;
      }
    }
    const row = await this.baseQuery().where('b.id = :id', { id }).getOne();
    if (!row) {
      throw new Error(`Budget ${id} not found`);
    }
    return this.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.budgets.delete({ id });
  }

  async getUsage(budgetIds: string[]): Promise<Map<string, BudgetUsage>> {
    if (budgetIds.length === 0) {
      return new Map();
    }
    const rows: { id: string; period_start: Date; period_end: Date; spent: string }[] =
      await this.budgets.query(USAGE_SQL, [budgetIds]);
    return new Map(
      rows.map((row) => [
        row.id,
        {
          spent: String(row.spent),
          periodStart: new Date(row.period_start),
          periodEnd: new Date(row.period_end),
        },
      ]),
    );
  }

  private baseQuery(): SelectQueryBuilder<BudgetOrmEntity> {
    return this.budgets
      .createQueryBuilder('b')
      .innerJoinAndSelect('b.category', 'category')
      .innerJoinAndSelect('b.account', 'account')
      .innerJoinAndSelect('account.currency', 'currency');
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === PG_UNIQUE_VIOLATION
    );
  }

  private toDomain(row: BudgetOrmEntity): Budget {
    const { category, account } = row;
    if (!category || !account?.currency) {
      throw new Error(`Budget ${row.id} loaded without category/wallet`);
    }
    return new Budget({
      id: row.id,
      userId: row.userId,
      categoryId: row.categoryId,
      accountId: row.accountId,
      amount: String(row.amount),
      period: row.period as BudgetPeriod,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      category: { id: category.id, name: category.name },
      account: {
        id: account.id,
        name: account.name,
        currencyCode: account.currencyCode.trim(),
        decimalPlaces: account.currency.decimalPlaces,
      },
    });
  }
}
