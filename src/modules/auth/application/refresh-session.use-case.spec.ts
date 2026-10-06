import { UnauthorizedException } from '@nestjs/common';
import {
  makeSession,
  makeSessionRepository,
  makeTokenService,
  makeUser,
  makeUserRepository,
} from '@/test-utils/auth-fixtures';
import { RefreshSessionUseCase } from './refresh-session.use-case';

describe('RefreshSessionUseCase', () => {
  const users = makeUserRepository();
  const sessions = makeSessionRepository();
  const tokens = makeTokenService();
  let useCase: RefreshSessionUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new RefreshSessionUseCase(users as never, sessions as never, tokens as never);
  });

  it('rotates refresh token and returns new tokens', async () => {
    const user = makeUser();
    const session = makeSession();
    const updated = makeSession({ id: 'session-2' });
    sessions.findByRefreshTokenHash.mockResolvedValue(session);
    users.findById.mockResolvedValue(user);
    sessions.updateRefreshTokenHash.mockResolvedValue(updated);

    const result = await useCase.execute({
      refreshToken: 'old-refresh',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(tokens.hashRefreshToken).toHaveBeenCalledWith('old-refresh');
    expect(sessions.findByRefreshTokenHash).toHaveBeenCalledWith('hash:old-refresh');
    expect(sessions.updateRefreshTokenHash).toHaveBeenCalledWith(
      session.id,
      'hash:refresh-token',
      tokens.getRefreshExpiresAt(),
    );
    expect(tokens.signAccessToken).toHaveBeenCalledWith({
      sub: user.id,
      sid: updated.id,
      email: user.email,
    });
    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    });
  });

  it('rejects missing session', async () => {
    sessions.findByRefreshTokenHash.mockResolvedValue(null);

    await expect(
      useCase.execute({ refreshToken: 'bad' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects inactive session', async () => {
    sessions.findByRefreshTokenHash.mockResolvedValue(
      makeSession({ revokedAt: new Date() }),
    );

    await expect(
      useCase.execute({ refreshToken: 'revoked' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when user is missing or inactive', async () => {
    sessions.findByRefreshTokenHash.mockResolvedValue(makeSession());
    users.findById.mockResolvedValue(makeUser({ isActive: false }));

    await expect(
      useCase.execute({ refreshToken: 'refresh' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
