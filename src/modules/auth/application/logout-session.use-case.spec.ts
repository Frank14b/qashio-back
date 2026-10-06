import { UnauthorizedException } from '@nestjs/common';
import {
  makeSession,
  makeSessionRepository,
  makeTokenService,
} from '@/test-utils/auth-fixtures';
import { LogoutSessionUseCase } from './logout-session.use-case';

describe('LogoutSessionUseCase', () => {
  const sessions = makeSessionRepository();
  const tokens = makeTokenService();
  let useCase: LogoutSessionUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new LogoutSessionUseCase(sessions as never, tokens as never);
  });

  it('revokes an active session and returns ids for activity logging', async () => {
    const session = makeSession();
    sessions.findByRefreshTokenHash.mockResolvedValue(session);
    sessions.revoke.mockResolvedValue(undefined);

    const result = await useCase.execute({
      refreshToken: 'refresh-token',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(sessions.findByRefreshTokenHash).toHaveBeenCalledWith('hash:refresh-token');
    expect(sessions.revoke).toHaveBeenCalledWith(session.id);
    expect(result).toEqual({
      userId: session.userId,
      sessionId: session.id,
    });
  });

  it('rejects missing session', async () => {
    sessions.findByRefreshTokenHash.mockResolvedValue(null);

    await expect(
      useCase.execute({ refreshToken: 'missing' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects inactive session', async () => {
    sessions.findByRefreshTokenHash.mockResolvedValue(
      makeSession({ expiresAt: new Date(Date.now() - 1_000) }),
    );

    await expect(
      useCase.execute({ refreshToken: 'expired' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(sessions.revoke).not.toHaveBeenCalled();
  });
});
