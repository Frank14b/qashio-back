import { AuthSession } from '../entities/auth-session.entity';

export const AUTH_SESSION_REPOSITORY = Symbol('AUTH_SESSION_REPOSITORY');

export type CreateAuthSessionInput = {
  userId: string;
  refreshTokenHash: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  expiresAt: Date;
};

export interface AuthSessionRepositoryPort {
  create(input: CreateAuthSessionInput): Promise<AuthSession>;
  findById(id: string): Promise<AuthSession | null>;
  findByRefreshTokenHash(hash: string): Promise<AuthSession | null>;
  updateRefreshTokenHash(id: string, refreshTokenHash: string, expiresAt: Date): Promise<AuthSession>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}
