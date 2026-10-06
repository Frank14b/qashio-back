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
import { ConfirmChangePasswordUseCase } from './confirm-change-password.use-case';
import { RequestChangePasswordUseCase } from './request-change-password.use-case';

describe('RequestChangePasswordUseCase', () => {
  const users = makeUserRepository();
  const passwords = makePasswordHasher();
  const otp = makeOtpService();
  const emails = makeEmailSender();
  let useCase: RequestChangePasswordUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    passwords.compare.mockResolvedValue(true);
    useCase = new RequestChangePasswordUseCase(
      users as never,
      passwords as never,
      otp as never,
      emails as never,
    );
  });

  it('verifies current password then emails OTP', async () => {
    users.findByEmail.mockResolvedValue(makeUser());
    otp.issue.mockResolvedValue('123456');

    const result = await useCase.execute({
      email: 'jane@example.com',
      currentPassword: 'Secret123!',
    });

    expect(passwords.compare).toHaveBeenCalled();
    expect(otp.issue).toHaveBeenCalledWith(
      'jane@example.com',
      OtpPurpose.PASSWORD_CHANGE,
    );
    expect(emails.send).toHaveBeenCalled();
    expect(result.message).toBeTruthy();
  });

  it('rejects wrong current password', async () => {
    users.findByEmail.mockResolvedValue(makeUser());
    passwords.compare.mockResolvedValue(false);

    await expect(
      useCase.execute({
        email: 'jane@example.com',
        currentPassword: 'wrong',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(otp.issue).not.toHaveBeenCalled();
  });
});

describe('ConfirmChangePasswordUseCase', () => {
  const users = makeUserRepository();
  const sessions = makeSessionRepository();
  const passwords = makePasswordHasher();
  const otp = makeOtpService();
  let useCase: ConfirmChangePasswordUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ConfirmChangePasswordUseCase(
      users as never,
      sessions as never,
      passwords as never,
      otp as never,
    );
  });

  it('changes password when OTP is valid', async () => {
    const user = makeUser();
    users.findByEmail.mockResolvedValue(user);
    otp.verify.mockResolvedValue(true);
    users.updatePasswordHash.mockResolvedValue(user);

    const result = await useCase.execute({
      email: 'jane@example.com',
      otp: '123456',
      newPassword: 'NewerSecret1!',
    });

    expect(otp.verify).toHaveBeenCalledWith(
      'jane@example.com',
      OtpPurpose.PASSWORD_CHANGE,
      '123456',
    );
    expect(users.updatePasswordHash).toHaveBeenCalledWith(
      user.id,
      'hashed:NewerSecret1!',
    );
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(user.id);
    expect(result.message).toContain('Password changed');
  });
});
