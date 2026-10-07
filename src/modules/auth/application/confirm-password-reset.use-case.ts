import {
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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

export type ConfirmPasswordResetCommand = {
  email: string;
  otp: string;
  /** Token returned by forgot-password; binds the OTP to the client that requested it. */
  otpToken: string;
  newPassword: string;
};

@Injectable()
export class ConfirmPasswordResetUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(AUTH_SESSION_REPOSITORY) private readonly sessions: AuthSessionRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasherPort,
    @Inject(OTP_SERVICE) private readonly otp: OtpPort,
  ) {}

  async execute(command: ConfirmPasswordResetCommand): Promise<{ message: string }> {
    const email = command.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or OTP');
    }

    const valid = await this.otp.verify(
      email,
      OtpPurpose.PASSWORD_RESET,
      command.otp,
      command.otpToken,
    );
    if (!valid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const passwordHash = await this.passwords.hash(command.newPassword);
    await this.users.updatePasswordHash(user.id, passwordHash);
    await this.sessions.revokeAllForUser(user.id);

    return { message: 'Password has been reset. Please sign in again.' };
  }
}
