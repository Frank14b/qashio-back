import { AuthSession } from '@/modules/auth/domain/entities/auth-session.entity';
import { User } from '@/modules/users/domain/entities/user.entity';

export function makeUser(overrides: Partial<ConstructorParameters<typeof User>[0]> = {}): User {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return new User({
    id: 'user-1',
    email: 'jane@example.com',
    passwordHash: 'hashed-password',
    displayName: 'Jane Doe',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

export function makeSession(
  overrides: Partial<ConstructorParameters<typeof AuthSession>[0]> = {},
): AuthSession {
  return new AuthSession({
    id: 'session-1',
    userId: 'user-1',
    refreshTokenHash: 'refresh-hash',
    userAgent: 'jest',
    ipAddress: '127.0.0.1',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  });
}

export function makePasswordHasher() {
  return {
    hash: jest.fn(async (plain: string) => `hashed:${plain}`),
    compare: jest.fn(async () => true),
  };
}

export function makeTokenService() {
  const expiresAt = new Date('2026-02-01T00:00:00.000Z');
  return {
    signAccessToken: jest.fn(async () => 'access-token'),
    generateRefreshToken: jest.fn(() => 'refresh-token'),
    hashRefreshToken: jest.fn((token: string) => `hash:${token}`),
    getRefreshExpiresAt: jest.fn(() => expiresAt),
  };
}

export function makeUserRepository() {
  return {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    activate: jest.fn(),
    updatePasswordHash: jest.fn(),
  };
}

export function makeOtpService() {
  return {
    issue: jest.fn(async () => '123456'),
    bindClient: jest.fn(async () => 'otp-client-token'),
    verify: jest.fn(async () => true),
  };
}

/** In-memory RefreshRotationStorePort; lock is free and no result is cached by default. */
export function makeRefreshRotationStore() {
  return {
    tryLock: jest.fn(async () => true),
    release: jest.fn(async () => undefined),
    getResult: jest.fn(async () => null as unknown),
    saveResult: jest.fn(async () => undefined),
  };
}

export function makeEmailSender() {
  return {
    send: jest.fn(async () => undefined),
  };
}

export function makeSessionRepository() {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByRefreshTokenHash: jest.fn(),
    updateRefreshTokenHash: jest.fn(),
    revoke: jest.fn(),
    revokeAllForUser: jest.fn(),
  };
}
