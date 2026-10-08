import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '@/modules/users/domain/ports/user.repository.port';
import {
  AUTH_SESSION_REPOSITORY,
  AuthSessionRepositoryPort,
} from '../domain/ports/auth-session.repository.port';
import { PASSWORD_HASHER, PasswordHasherPort } from '../domain/ports/password-hasher.port';
import { TOKEN_SERVICE, TokenServicePort } from '../domain/ports/token.service.port';
import { AuthTokensResult, RequestContext } from './auth.types';

export type LoginUserCommand = {
  email: string;
  password: string;
} & RequestContext;

@Injectable()
export class LoginUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(AUTH_SESSION_REPOSITORY) private readonly sessions: AuthSessionRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasherPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
  ) {}

  async execute(command: LoginUserCommand): Promise<AuthTokensResult> {
    const email = command.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.passwords.compare(command.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const refreshToken = this.tokens.generateRefreshToken();
    const session = await this.sessions.create({
      userId: user.id,
      refreshTokenHash: this.tokens.hashRefreshToken(refreshToken),
      userAgent: command.userAgent,
      ipAddress: command.ipAddress,
      expiresAt: this.tokens.getRefreshExpiresAt(),
    });

    const accessToken = await this.tokens.signAccessToken({
      sub: user.id,
      sid: session.id,
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
