import {
  makeEmailSender,
  makeOtpService,
  makeUser,
  makeUserRepository,
} from '@/test-utils/auth-fixtures';
import { OtpPurpose } from '../domain/otp-purpose';
import { RequestPasswordResetUseCase } from './request-password-reset.use-case';

describe('RequestPasswordResetUseCase otpToken', () => {
  const users = makeUserRepository();
  const otp = makeOtpService();
  const emails = makeEmailSender();
  const useCase = new RequestPasswordResetUseCase(users as never, otp as never, emails as never);

  beforeEach(() => jest.clearAllMocks());

  it('binds the issued OTP to the requesting client and returns its token', async () => {
    users.findByEmail.mockResolvedValue(makeUser());

    const result = await useCase.execute({ email: 'jane@example.com' });

    // Bind after issue: issuing clears any previous binding.
    expect(otp.issue.mock.invocationCallOrder[0]).toBeLessThan(
      otp.bindClient.mock.invocationCallOrder[0],
    );
    expect(otp.bindClient).toHaveBeenCalledWith('jane@example.com', OtpPurpose.PASSWORD_RESET);
    expect(result.otpToken).toBe('otp-client-token');
  });

  it('returns a token of the same shape for unknown emails (no account enumeration)', async () => {
    users.findByEmail.mockResolvedValue(null);

    const result = await useCase.execute({ email: 'missing@example.com' });

    expect(otp.issue).not.toHaveBeenCalled();
    expect(result).toEqual({
      message: expect.stringContaining('If an account exists'),
      otpToken: 'otp-client-token',
    });
  });
});
