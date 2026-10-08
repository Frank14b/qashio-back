import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '@/modules/users/domain/ports/user.repository.port';
import {
  AUTH_SESSION_REPOSITORY,
  AuthSessionRepositoryPort,
} from '../domain/ports/auth-session.repository.port';
import {
  REFRESH_ROTATION_STORE,
  RefreshRotationStorePort,
} from '../domain/ports/refresh-rotation.port';
import { TOKEN_SERVICE, TokenServicePort } from '../domain/ports/token.service.port';
import { AuthTokensResult, RequestContext } from './auth.types';

export type RefreshSessionCommand = {
  refreshToken: string;
} & RequestContext;

/** Upper bound for one rotation (DB read + update + JWT sign). */
export const REFRESH_LOCK_TTL_MS = 5_000;
/**
 * How long a rotation result is replayed to concurrent/late requests that still
 * send the old refresh token (parallel calls, other tabs) instead of logging them out.
 */
export const REFRESH_GRACE_MS = 30_000;
const WAIT_POLL_MS = 100;

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(AUTH_SESSION_REPOSITORY) private readonly sessions: AuthSessionRepositoryPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
    @Inject(REFRESH_ROTATION_STORE) private readonly rotations: RefreshRotationStorePort,
  ) {}

  async execute(command: RefreshSessionCommand): Promise<AuthTokensResult> {
    const hash = this.tokens.hashRefreshToken(command.refreshToken);

    const replay = await this.rotations.getResult<AuthTokensResult>(hash);
    if (replay) {
      return replay;
    }

    if (!(await this.rotations.tryLock(hash, REFRESH_LOCK_TTL_MS))) {
      // Another request is rotating this exact token: share its result.
      return this.waitForRotation(hash);
    }

    try {
      const result = await this.rotate(hash);
      await this.rotations.saveResult(hash, result, REFRESH_GRACE_MS);
      return result;
    } finally {
      await this.rotations.release(hash);
    }
  }

  private async rotate(hash: string): Promise<AuthTokensResult> {
    const session = await this.sessions.findByRefreshTokenHash(hash);
    if (!session || !session.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.users.findById(session.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const refreshToken = this.tokens.generateRefreshToken();
    const updated = await this.sessions.updateRefreshTokenHash(
      session.id,
      this.tokens.hashRefreshToken(refreshToken),
      this.tokens.getRefreshExpiresAt(),
    );

    const accessToken = await this.tokens.signAccessToken({
      sub: user.id,
      sid: updated.id,
      email: user.email,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    };
  }

  private async waitForRotation(hash: string): Promise<AuthTokensResult> {
    for (let waited = 0; waited < REFRESH_LOCK_TTL_MS; waited += WAIT_POLL_MS) {
      await sleep(WAIT_POLL_MS);
      const result = await this.rotations.getResult<AuthTokensResult>(hash);
      if (result) {
        return result;
      }
    }
    // The holder failed (e.g. token was already invalid): treat like an invalid token.
    throw new UnauthorizedException('Invalid refresh token');
  }
}
