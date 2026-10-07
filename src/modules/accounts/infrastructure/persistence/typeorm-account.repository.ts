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
      select: ['name'],
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
    if (input.archivedAt !== undefined) {
      row.archivedAt = input.archivedAt;
      if (input.archivedAt != null) {
        row.isDefault = false;
      }
    }
    const saved = await this.accounts.save(row);
    return this.toDomain(saved);
  }

  private toDomain(row: AccountOrmEntity): Account {
    return new Account({
      id: row.id,
      userId: row.userId,
      name: row.name,
      currencyCode: row.currencyCode.trim(),
      isDefault: row.isDefault,
      archivedAt: row.archivedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
