import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '@/modules/users/domain/ports/user.repository.port';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisherPort,
} from '@/shared/events/domain-event-publisher.port';
import {
  USER_ACTIVATED_EVENT,
  UserActivatedPayload,
} from '../domain/events/user-activated.event';
import { OtpPurpose } from '../domain/otp-purpose';
import {
  AUTH_SESSION_REPOSITORY,
  AuthSessionRepositoryPort,
} from '../domain/ports/auth-session.repository.port';
import { OTP_SERVICE, OtpPort } from '../domain/ports/otp.port';
import { TOKEN_SERVICE, TokenServicePort } from '../domain/ports/token.service.port';
import { AuthTokensResult, RequestContext } from './auth.types';

export type VerifyEmailCommand = {
  email: string;
  otp: string;
} & RequestContext;

@Injectable()
export class VerifyEmailUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(AUTH_SESSION_REPOSITORY) private readonly sessions: AuthSessionRepositoryPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
    @Inject(OTP_SERVICE) private readonly otp: OtpPort,
    @Optional()
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly events?: DomainEventPublisherPort,
  ) {}

  async execute(command: VerifyEmailCommand): Promise<AuthTokensResult> {
    const email = command.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new BadRequestException('Invalid email or OTP');
    }

    if (user.isActive) {
      throw new BadRequestException('Email is already verified');
    }

    const valid = await this.otp.verify(email, OtpPurpose.EMAIL_VERIFY, command.otp);
    if (!valid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const activated = await this.users.activate(user.id);

    const payload: UserActivatedPayload = { userId: activated.id };
    this.events?.emit(USER_ACTIVATED_EVENT, payload);

    const refreshToken = this.tokens.generateRefreshToken();
    const session = await this.sessions.create({
      userId: activated.id,
      refreshTokenHash: this.tokens.hashRefreshToken(refreshToken),
      userAgent: command.userAgent,
      ipAddress: command.ipAddress,
      expiresAt: this.tokens.getRefreshExpiresAt(),
    });

    const accessToken = await this.tokens.signAccessToken({
      sub: activated.id,
      sid: session.id,
      email: activated.email,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: activated.id,
        email: activated.email,
        displayName: activated.displayName,
      },
    };
  }
}
