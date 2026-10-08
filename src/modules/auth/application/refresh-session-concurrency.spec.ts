import { UnauthorizedException } from '@nestjs/common';
import {
  makeSession,
  makeSessionRepository,
  makeTokenService,
  makeUser,
  makeUserRepository,
} from '@/test-utils/auth-fixtures';
import { RefreshRotationStorePort } from '../domain/ports/refresh-rotation.port';
import { RefreshSessionUseCase } from './refresh-session.use-case';

/** In-memory store with real NX semantics, shared by "concurrent" requests. */
function memoryRotationStore(): RefreshRotationStorePort {
  const locks = new Set<string>();
  const results = new Map<string, unknown>();
  return {
    tryLock: async (hash) => (locks.has(hash) ? false : (locks.add(hash), true)),
    release: async (hash) => void locks.delete(hash),
    getResult: async <T>(hash: string) => (results.get(hash) as T | undefined) ?? null,
    saveResult: async (hash, result) => void results.set(hash, result),
  };
}

describe('RefreshSessionUseCase under concurrent refreshes', () => {
  const users = makeUserRepository();
  const sessions = makeSessionRepository();
  const tokens = makeTokenService();
  let useCase: RefreshSessionUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new RefreshSessionUseCase(
      users as never,
      sessions as never,
      tokens as never,
      memoryRotationStore(),
    );
    users.findById.mockResolvedValue(makeUser());
    sessions.updateRefreshTokenHash.mockResolvedValue(makeSession());
  });

  it('rotates once and gives every concurrent caller the same new tokens', async () => {
    // Slow DB lookup so both requests overlap.
    sessions.findByRefreshTokenHash.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(makeSession()), 150)),
    );
    let issued = 0;
    tokens.generateRefreshToken.mockImplementation(() => `refresh-${(issued += 1)}`);

    const [first, second] = await Promise.all([
      useCase.execute({ refreshToken: 'old-refresh' }),
      useCase.execute({ refreshToken: 'old-refresh' }),
    ]);

    expect(sessions.updateRefreshTokenHash).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first.refreshToken).toBe('refresh-1');
  });

  it('replays the rotation result to a late request with the same old token', async () => {
    sessions.findByRefreshTokenHash.mockResolvedValue(makeSession());

    const first = await useCase.execute({ refreshToken: 'old-refresh' });
    const late = await useCase.execute({ refreshToken: 'old-refresh' });

    expect(late).toEqual(first);
    expect(sessions.findByRefreshTokenHash).toHaveBeenCalledTimes(1);
  });

  it('fails every waiter when the token was invalid, without caching a result', async () => {
    sessions.findByRefreshTokenHash.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(null), 150)),
    );

    const results = await Promise.allSettled([
      useCase.execute({ refreshToken: 'stolen' }),
      useCase.execute({ refreshToken: 'stolen' }),
    ]);

    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    for (const result of results) {
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(UnauthorizedException);
    }
  }, 10_000);
});
