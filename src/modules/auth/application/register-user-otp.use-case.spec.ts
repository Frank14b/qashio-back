import { ConflictException } from '@nestjs/common';
import {
  makeEmailSender,
  makeOtpService,
  makePasswordHasher,
  makeSessionRepository,
  makeTokenService,
  makeUser,
  makeUserRepository,
} from '@/test-utils/auth-fixtures';
import { OtpPurpose } from '../domain/otp-purpose';
import { RegisterUserUseCase } from './register-user.use-case';

describe('RegisterUserUseCase (email OTP verification)', () => {
  const users = makeUserRepository();
  const sessions = makeSessionRepository();
  const passwords = makePasswordHasher();
  const tokens = makeTokenService();
  const otp = makeOtpService();
  const emails = makeEmailSender();
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new RegisterUserUseCase(
      users as never,
      sessions as never,
      passwords as never,
      tokens as never,
      otp as never,
      emails as never,
    );
  });

  it('creates an inactive user, stores OTP, and emails the code', async () => {
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue(makeUser({ isActive: false }));
    otp.issue.mockResolvedValue('123456');

    const result = await useCase.execute({
      email: '  Jane@Example.com ',
      password: 'Secret123!',
      displayName: '  Jane  ',
    });

    expect(users.create).toHaveBeenCalledWith({
      email: 'jane@example.com',
      passwordHash: 'hashed:Secret123!',
      displayName: 'Jane',
      isActive: false,
    });
    expect(otp.issue).toHaveBeenCalledWith('jane@example.com', OtpPurpose.EMAIL_VERIFY);
    expect(emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        subject: expect.stringContaining('Verify'),
      }),
    );
    expect(sessions.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      email: 'jane@example.com',
      message: expect.any(String),
      requiresEmailVerification: true,
    });
  });

  it('throws ConflictException when email already exists', async () => {
    users.findByEmail.mockResolvedValue(makeUser());

    await expect(
      useCase.execute({
        email: 'jane@example.com',
        password: 'Secret123!',
        displayName: 'Jane',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(users.create).not.toHaveBeenCalled();
    expect(otp.issue).not.toHaveBeenCalled();
  });
});
