import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '@/modules/users/domain/ports/user.repository.port';
import {
  AUTH_SESSION_REPOSITORY,
  AuthSessionRepositoryPort,
} from '../domain/ports/auth-session.repository.port';
import { TOKEN_SERVICE, TokenServicePort } from '../domain/ports/token.service.port';
import { AuthTokensResult, RequestContext } from './auth.types';

export type RefreshSessionCommand = {
  refreshToken: string;
} & RequestContext;

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(AUTH_SESSION_REPOSITORY) private readonly sessions: AuthSessionRepositoryPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
  ) {}

  async execute(command: RefreshSessionCommand): Promise<AuthTokensResult> {
    const hash = this.tokens.hashRefreshToken(command.refreshToken);
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
}
