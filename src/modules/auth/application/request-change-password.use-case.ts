import {
  Inject,
  Injectable,
  UnauthorizedException,
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
import { OTP_SERVICE, OtpPort } from '../domain/ports/otp.port';
import { PASSWORD_HASHER, PasswordHasherPort } from '../domain/ports/password-hasher.port';
import { OtpSentResult } from './auth.types';

export type RequestChangePasswordCommand = {
  email: string;
  currentPassword: string;
};

@Injectable()
export class RequestChangePasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasherPort,
    @Inject(OTP_SERVICE) private readonly otp: OtpPort,
    @Inject(EMAIL_SENDER) private readonly emails: EmailSenderPort,
  ) {}

  async execute(command: RequestChangePasswordCommand): Promise<OtpSentResult> {
    const email = command.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.passwords.compare(command.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const code = await this.otp.issue(email, OtpPurpose.PASSWORD_CHANGE);
    await this.emails.send({
      to: email,
      subject: 'Confirm your Qashio password change',
      text: `Your password change code is ${code}. It expires soon.`,
      html: `<p>Your password change code is <strong>${code}</strong>.</p>`,
    });

    return { message: 'If the credentials are valid, a confirmation OTP has been sent.' };
  }
}
