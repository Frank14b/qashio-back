import {
  ConflictException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import {
  EMAIL_SENDER,
  EmailSenderPort,
} from '@/shared/email/domain/ports/email-sender.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '@/modules/users/domain/ports/user.repository.port';
import { OtpPurpose } from '../domain/otp-purpose';
import {
  AUTH_SESSION_REPOSITORY,
  AuthSessionRepositoryPort,
} from '../domain/ports/auth-session.repository.port';
import { OTP_SERVICE, OtpPort } from '../domain/ports/otp.port';
import { PASSWORD_HASHER, PasswordHasherPort } from '../domain/ports/password-hasher.port';
import { TOKEN_SERVICE, TokenServicePort } from '../domain/ports/token.service.port';
import {
  AuthTokensResult,
  EmailVerificationPendingResult,
  RequestContext,
} from './auth.types';

export type RegisterUserCommand = {
  email: string;
  password: string;
  displayName: string;
} & RequestContext;

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(AUTH_SESSION_REPOSITORY) private readonly sessions: AuthSessionRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasherPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
    @Optional() @Inject(OTP_SERVICE) private readonly otp?: OtpPort,
    @Optional() @Inject(EMAIL_SENDER) private readonly emails?: EmailSenderPort,
  ) {}

  async execute(
    command: RegisterUserCommand,
  ): Promise<AuthTokensResult | EmailVerificationPendingResult> {
    const email = command.email.trim().toLowerCase();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await this.passwords.hash(command.password);
    const displayName = command.displayName.trim();

    if (this.otp && this.emails) {
      await this.users.create({
        email,
        passwordHash,
        displayName,
        isActive: false,
      });

      const code = await this.otp.issue(email, OtpPurpose.EMAIL_VERIFY);
      await this.emails.send({
        to: email,
        subject: 'Verify your Qashio email',
        text: `Your verification code is ${code}. It expires soon.`,
        html: `<p>Your verification code is <strong>${code}</strong>.</p>`,
      });

      return {
        email,
        message: 'Registration successful. Verify your email with the OTP sent to your inbox.',
        requiresEmailVerification: true,
      };
    }

    const user = await this.users.create({
      email,
      passwordHash,
      displayName,
    });

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
