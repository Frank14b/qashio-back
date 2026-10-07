import {
  makeOtpService,
  makeSession,
  makeSessionRepository,
  makeTokenService,
  makeUser,
  makeUserRepository,
} from '@/test-utils/auth-fixtures';
import { USER_ACTIVATED_EVENT } from '../domain/events/user-activated.event';
import { VerifyEmailUseCase } from './verify-email.use-case';

describe('VerifyEmailUseCase user.activated event', () => {
  const users = makeUserRepository();
  const sessions = makeSessionRepository();
  const tokens = makeTokenService();
  const otp = makeOtpService();
  const events = { emit: jest.fn() };
  let useCase: VerifyEmailUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new VerifyEmailUseCase(
      users as never,
      sessions as never,
      tokens as never,
      otp as never,
      events as never,
    );
  });

  it('emits user.activated after successful activation', async () => {
    const pending = makeUser({ isActive: false });
    const activated = makeUser({ isActive: true });
    users.findByEmail.mockResolvedValue(pending);
    otp.verify.mockResolvedValue(true);
    users.activate.mockResolvedValue(activated);
    sessions.create.mockResolvedValue(makeSession({ userId: activated.id }));

    await useCase.execute({
      email: 'jane@example.com',
      otp: '123456',
    });

    expect(events.emit).toHaveBeenCalledWith(USER_ACTIVATED_EVENT, {
      userId: activated.id,
    });
  });

  it('does not emit when OTP is invalid', async () => {
    users.findByEmail.mockResolvedValue(makeUser({ isActive: false }));
    otp.verify.mockResolvedValue(false);

    await expect(
      useCase.execute({ email: 'jane@example.com', otp: '000000' }),
    ).rejects.toBeDefined();

    expect(events.emit).not.toHaveBeenCalled();
  });
});
