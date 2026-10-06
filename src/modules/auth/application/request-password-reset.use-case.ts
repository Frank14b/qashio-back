import { Inject, Injectable } from '@nestjs/common';
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
import { OtpSentResult } from './auth.types';

export type RequestPasswordResetCommand = {
  email: string;
};

const GENERIC_MESSAGE =
  'If an account exists for that email, a password reset OTP has been sent.';

@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(OTP_SERVICE) private readonly otp: OtpPort,
    @Inject(EMAIL_SENDER) private readonly emails: EmailSenderPort,
  ) {}

  async execute(command: RequestPasswordResetCommand): Promise<OtpSentResult> {
    const email = command.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);

    if (user?.isActive) {
      const code = await this.otp.issue(email, OtpPurpose.PASSWORD_RESET);
      await this.emails.send({
        to: email,
        subject: 'Reset your Qashio password',
        text: `Your password reset code is ${code}. It expires soon.`,
        html: `<p>Your password reset code is <strong>${code}</strong>.</p>`,
      });
    }

    return { message: GENERIC_MESSAGE };
  }
}
