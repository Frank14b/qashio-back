import { AuthSession } from './auth-session.entity';

describe('AuthSession', () => {
  it('isActive when not revoked and not expired', () => {
    const session = new AuthSession({
      id: 's1',
      userId: 'u1',
      refreshTokenHash: 'hash',
      userAgent: null,
      ipAddress: null,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
    });

    expect(session.isActive).toBe(true);
  });

  it('is not active when revoked', () => {
    const session = new AuthSession({
      id: 's1',
      userId: 'u1',
      refreshTokenHash: 'hash',
      userAgent: null,
      ipAddress: null,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      createdAt: new Date(),
    });

    expect(session.isActive).toBe(false);
  });

  it('is not active when expired', () => {
    const session = new AuthSession({
      id: 's1',
      userId: 'u1',
      refreshTokenHash: 'hash',
      userAgent: null,
      ipAddress: null,
      expiresAt: new Date(Date.now() - 1_000),
      revokedAt: null,
      createdAt: new Date(),
    });

    expect(session.isActive).toBe(false);
  });
});
