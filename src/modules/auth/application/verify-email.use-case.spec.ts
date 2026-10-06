import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import {
  makeOtpService,
  makeSession,
  makeSessionRepository,
  makeTokenService,
  makeUser,
  makeUserRepository,
} from '@/test-utils/auth-fixtures';
import { OtpPurpose } from '../domain/otp-purpose';
import { VerifyEmailUseCase } from './verify-email.use-case';

describe('VerifyEmailUseCase', () => {
  const users = makeUserRepository();
  const sessions = makeSessionRepository();
  const tokens = makeTokenService();
  const otp = makeOtpService();
  let useCase: VerifyEmailUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new VerifyEmailUseCase(
      users as never,
      sessions as never,
      tokens as never,
      otp as never,
    );
  });

  it('activates the user and returns tokens when OTP is valid', async () => {
    const pending = makeUser({ isActive: false });
    const activated = makeUser({ isActive: true });
    const session = makeSession({ userId: activated.id });
    users.findByEmail.mockResolvedValue(pending);
    otp.verify.mockResolvedValue(true);
    users.activate.mockResolvedValue(activated);
    sessions.create.mockResolvedValue(session);

    const result = await useCase.execute({
      email: 'Jane@Example.com',
      otp: '123456',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(otp.verify).toHaveBeenCalledWith(
      'jane@example.com',
      OtpPurpose.EMAIL_VERIFY,
      '123456',
    );
    expect(users.activate).toHaveBeenCalledWith(pending.id);
    expect(result.accessToken).toBe('access-token');
    expect(result.user.id).toBe(activated.id);
  });

  it('rejects invalid OTP', async () => {
    users.findByEmail.mockResolvedValue(makeUser({ isActive: false }));
    otp.verify.mockResolvedValue(false);

    await expect(
      useCase.execute({ email: 'jane@example.com', otp: '000000' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(users.activate).not.toHaveBeenCalled();
  });

  it('rejects already verified email', async () => {
    users.findByEmail.mockResolvedValue(makeUser({ isActive: true }));

    await expect(
      useCase.execute({ email: 'jane@example.com', otp: '123456' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
