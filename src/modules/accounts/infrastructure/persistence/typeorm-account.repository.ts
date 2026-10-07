import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Account } from '../../domain/entities/account.entity';
import {
  AccountRepositoryPort,
  CreateAccountInput,
  ListAccountsQuery,
  UpdateAccountInput,
} from '../../domain/ports/account.repository.port';
import { AccountOrmEntity } from './account.orm-entity';

@Injectable()
export class TypeOrmAccountRepository implements AccountRepositoryPort {
  constructor(
    @InjectRepository(AccountOrmEntity)
    private readonly accounts: Repository<AccountOrmEntity>,
  ) {}

  async create(input: CreateAccountInput): Promise<Account> {
    const row = this.accounts.create({
      userId: input.userId,
      name: input.name,
      currencyCode: input.currencyCode.toUpperCase(),
      isDefault: input.isDefault,
      openingBalance: input.openingBalance ?? '0',
      archivedAt: null,
    });
    const saved = await this.accounts.save(row);
    return this.toDomain(saved);
  }

  async createMany(inputs: CreateAccountInput[]): Promise<Account[]> {
    if (inputs.length === 0) {
      return [];
    }
    const rows = inputs.map((input) =>
      this.accounts.create({
        userId: input.userId,
        name: input.name,
        currencyCode: input.currencyCode.toUpperCase(),
        isDefault: input.isDefault,
        openingBalance: input.openingBalance ?? '0',
        archivedAt: null,
      }),
    );
    const saved = await this.accounts.save(rows);
    return saved.map((row) => this.toDomain(row));
  }

  async findById(id: string): Promise<Account | null> {
    const row = await this.accounts.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByIdForUser(id: string, userId: string): Promise<Account | null> {
    const row = await this.accounts.findOne({ where: { id, userId } });
    return row ? this.toDomain(row) : null;
  }

  async findDefaultForUser(userId: string): Promise<Account | null> {
    const row = await this.accounts.findOne({
      where: { userId, isDefault: true, archivedAt: IsNull() },
    });
    return row ? this.toDomain(row) : null;
  }

  async findMany(query: ListAccountsQuery): Promise<Account[]> {
    const where = query.includeArchived
      ? { userId: query.userId }
      : { userId: query.userId, archivedAt: IsNull() };
    const rows = await this.accounts.find({
      where,
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findNamesByUserId(userId: string): Promise<Set<string>> {
    const rows = await this.accounts.find({
      where: { userId },
      select: { name: true },
    });
    return new Set(rows.map((row) => row.name));
  }

  async countActiveForUser(userId: string): Promise<number> {
    return this.accounts.count({
      where: { userId, archivedAt: IsNull() },
    });
  }

  async clearDefaultForUser(userId: string): Promise<void> {
    await this.accounts.update({ userId, isDefault: true }, { isDefault: false });
  }

  async update(id: string, input: UpdateAccountInput): Promise<Account> {
    const row = await this.accounts.findOne({ where: { id } });
    if (!row) {
      throw new Error(`Account ${id} not found`);
    }
    if (input.name !== undefined) {
      row.name = input.name;
    }
    if (input.isDefault !== undefined) {
      row.isDefault = input.isDefault;
    }
    if (input.openingBalance !== undefined) {
      row.openingBalance = input.openingBalance;
    }
    if (input.archivedAt !== undefined) {
      row.archivedAt = input.archivedAt;
      if (input.archivedAt != null) {
        row.isDefault = false;
      }
    }
    const saved = await this.accounts.save(row);
    return this.toDomain(saved);
  }

  async getBalances(userId: string, accountIds: string[]): Promise<Map<string, string>> {
    if (accountIds.length === 0) {
      return new Map();
    }
    // Only completed transactions move the balance; `type` decides the sign.
    const rows = await this.accounts
      .createQueryBuilder('a')
      .select('a.id', 'id')
      .addSelect(
        `a.opening_balance + COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0)`,
        'balance',
      )
      .leftJoin('transactions', 't', `t.account_id = a.id AND t.status = 'completed'`)
      .where('a.user_id = :userId', { userId })
      .andWhere('a.id IN (:...accountIds)', { accountIds })
      .groupBy('a.id')
      .getRawMany<{ id: string; balance: string }>();
    return new Map(rows.map((row) => [row.id, String(row.balance)]));
  }

  private toDomain(row: AccountOrmEntity): Account {
    return new Account({
      id: row.id,
      userId: row.userId,
      name: row.name,
      currencyCode: row.currencyCode.trim(),
      openingBalance: String(row.openingBalance),
      isDefault: row.isDefault,
      archivedAt: row.archivedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
