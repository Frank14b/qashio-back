import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  AUTH_SESSION_REPOSITORY,
  AuthSessionRepositoryPort,
} from '../domain/ports/auth-session.repository.port';
import { TOKEN_SERVICE, TokenServicePort } from '../domain/ports/token.service.port';
import { RequestContext } from './auth.types';

export type LogoutSessionCommand = {
  refreshToken: string;
} & RequestContext;

export type LogoutSessionResult = {
  userId: string;
  sessionId: string;
};

@Injectable()
export class LogoutSessionUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY) private readonly sessions: AuthSessionRepositoryPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
  ) {}

  async execute(command: LogoutSessionCommand): Promise<LogoutSessionResult> {
    const hash = this.tokens.hashRefreshToken(command.refreshToken);
    const session = await this.sessions.findByRefreshTokenHash(hash);
    if (!session || !session.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.sessions.revoke(session.id);

    return {
      userId: session.userId,
      sessionId: session.id,
    };
  }
}
