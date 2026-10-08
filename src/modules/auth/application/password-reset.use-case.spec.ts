import { UnauthorizedException } from '@nestjs/common';
import {
  makeEmailSender,
  makeOtpService,
  makePasswordHasher,
  makeSessionRepository,
  makeUser,
  makeUserRepository,
} from '@/test-utils/auth-fixtures';
import { OtpPurpose } from '../domain/otp-purpose';
import { ConfirmPasswordResetUseCase } from './confirm-password-reset.use-case';
import { RequestPasswordResetUseCase } from './request-password-reset.use-case';

describe('RequestPasswordResetUseCase', () => {
  const users = makeUserRepository();
  const otp = makeOtpService();
  const emails = makeEmailSender();
  let useCase: RequestPasswordResetUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new RequestPasswordResetUseCase(
      users as never,
      otp as never,
      emails as never,
    );
  });

  it('sends OTP when user exists and is active', async () => {
    users.findByEmail.mockResolvedValue(makeUser());
    otp.issue.mockResolvedValue('123456');

    const result = await useCase.execute({ email: 'Jane@Example.com' });

    expect(otp.issue).toHaveBeenCalledWith(
      'jane@example.com',
      OtpPurpose.PASSWORD_RESET,
    );
    expect(emails.send).toHaveBeenCalled();
    expect(result.message).toContain('If an account exists');
  });

  it('returns the same message without leaking when user is missing', async () => {
    users.findByEmail.mockResolvedValue(null);

    const result = await useCase.execute({ email: 'missing@example.com' });

    expect(otp.issue).not.toHaveBeenCalled();
    expect(emails.send).not.toHaveBeenCalled();
    expect(result.message).toContain('If an account exists');
  });
});

describe('ConfirmPasswordResetUseCase', () => {
  const users = makeUserRepository();
  const sessions = makeSessionRepository();
  const passwords = makePasswordHasher();
  const otp = makeOtpService();
  let useCase: ConfirmPasswordResetUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ConfirmPasswordResetUseCase(
      users as never,
      sessions as never,
      passwords as never,
      otp as never,
    );
  });

  it('updates password and revokes sessions when OTP is valid', async () => {
    const user = makeUser();
    users.findByEmail.mockResolvedValue(user);
    otp.verify.mockResolvedValue(true);
    users.updatePasswordHash.mockResolvedValue(user);

    const result = await useCase.execute({
      email: 'jane@example.com',
      otp: '123456',
      otpToken: 'otp-client-token',
      newPassword: 'NewSecret1!',
    });

    expect(otp.verify).toHaveBeenCalledWith(
      'jane@example.com',
      OtpPurpose.PASSWORD_RESET,
      '123456',
      'otp-client-token',
    );
    expect(passwords.hash).toHaveBeenCalledWith('NewSecret1!');
    expect(users.updatePasswordHash).toHaveBeenCalledWith(
      user.id,
      'hashed:NewSecret1!',
    );
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(user.id);
    expect(result.message).toContain('Password has been reset');
  });

  it('rejects invalid OTP', async () => {
    users.findByEmail.mockResolvedValue(makeUser());
    otp.verify.mockResolvedValue(false);

    await expect(
      useCase.execute({
        email: 'jane@example.com',
        otp: '000000',
        otpToken: 'otp-client-token',
        newPassword: 'NewSecret1!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
