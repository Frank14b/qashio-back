import { InjectTransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TypeOrmTransactionHost } from '@/shared/database/transaction-host';
import { User } from '../../domain/entities/user.entity';
import {
  CreateUserInput,
  UserRepositoryPort,
} from '../../domain/ports/user.repository.port';
import { UserOrmEntity } from './user.orm-entity';

@Injectable()
export class TypeOrmUserRepository implements UserRepositoryPort {
  constructor(@InjectTransactionHost() private readonly txHost: TypeOrmTransactionHost) {}

  /** Joins the caller's UnitOfWork transaction when there is one. */
  private get users(): Repository<UserOrmEntity> {
    return this.txHost.tx.getRepository(UserOrmEntity);
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.users.findOne({ where: { email: email.toLowerCase() } });
    return row ? this.toDomain(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.users.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const row = this.users.create({
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      isActive: input.isActive ?? true,
    });
    const saved = await this.users.save(row);
    return this.toDomain(saved);
  }

  async activate(id: string): Promise<User> {
    const row = await this.users.findOne({ where: { id } });
    if (!row) {
      throw new Error(`User ${id} not found`);
    }
    row.isActive = true;
    const saved = await this.users.save(row);
    return this.toDomain(saved);
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<User> {
    const row = await this.users.findOne({ where: { id } });
    if (!row) {
      throw new Error(`User ${id} not found`);
    }
    row.passwordHash = passwordHash;
    const saved = await this.users.save(row);
    return this.toDomain(saved);
  }

  private toDomain(row: UserOrmEntity): User {
    return new User({
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      displayName: row.displayName,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
