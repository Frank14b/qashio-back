import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthSession } from '../../domain/entities/auth-session.entity';
import {
  AuthSessionRepositoryPort,
  CreateAuthSessionInput,
} from '../../domain/ports/auth-session.repository.port';
import { AuthSessionOrmEntity } from './auth-session.orm-entity';

@Injectable()
export class TypeOrmAuthSessionRepository implements AuthSessionRepositoryPort {
  constructor(
    @InjectRepository(AuthSessionOrmEntity)
    private readonly sessions: Repository<AuthSessionOrmEntity>,
  ) {}

  async create(input: CreateAuthSessionInput): Promise<AuthSession> {
    const row = this.sessions.create({
      userId: input.userId,
      refreshTokenHash: input.refreshTokenHash,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
      expiresAt: input.expiresAt,
      revokedAt: null,
    });
    const saved = await this.sessions.save(row);
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<AuthSession | null> {
    const row = await this.sessions.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByRefreshTokenHash(hash: string): Promise<AuthSession | null> {
    const row = await this.sessions.findOne({ where: { refreshTokenHash: hash } });
    return row ? this.toDomain(row) : null;
  }

  async updateRefreshTokenHash(
    id: string,
    refreshTokenHash: string,
    expiresAt: Date,
  ): Promise<AuthSession> {
    await this.sessions.update({ id }, { refreshTokenHash, expiresAt });
    const row = await this.sessions.findOneOrFail({ where: { id } });
    return this.toDomain(row);
  }

  async revoke(id: string): Promise<void> {
    await this.sessions.update({ id }, { revokedAt: new Date() });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.sessions
      .createQueryBuilder()
      .update(AuthSessionOrmEntity)
      .set({ revokedAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  private toDomain(row: AuthSessionOrmEntity): AuthSession {
    return new AuthSession({
      id: row.id,
      userId: row.userId,
      refreshTokenHash: row.refreshTokenHash,
      userAgent: row.userAgent,
      ipAddress: row.ipAddress,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
    });
  }
}
