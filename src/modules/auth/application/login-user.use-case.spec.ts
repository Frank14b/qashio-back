import { UnauthorizedException } from '@nestjs/common';
import {
  makePasswordHasher,
  makeSession,
  makeSessionRepository,
  makeTokenService,
  makeUser,
  makeUserRepository,
} from '@/test-utils/auth-fixtures';
import { LoginUserUseCase } from './login-user.use-case';

describe('LoginUserUseCase', () => {
  const users = makeUserRepository();
  const sessions = makeSessionRepository();
  const passwords = makePasswordHasher();
  const tokens = makeTokenService();
  let useCase: LoginUserUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    passwords.compare.mockResolvedValue(true);
    useCase = new LoginUserUseCase(
      users as never,
      sessions as never,
      passwords as never,
      tokens as never,
    );
  });

  it('logs in an active user and returns tokens', async () => {
    const user = makeUser();
    const session = makeSession();
    users.findByEmail.mockResolvedValue(user);
    sessions.create.mockResolvedValue(session);

    const result = await useCase.execute({
      email: '  Jane@Example.com ',
      password: 'Secret123!',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(users.findByEmail).toHaveBeenCalledWith('jane@example.com');
    expect(passwords.compare).toHaveBeenCalledWith('Secret123!', user.passwordHash);
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user.id).toBe(user.id);
  });

  it('rejects unknown email', async () => {
    users.findByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute({ email: 'missing@example.com', password: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects inactive user', async () => {
    users.findByEmail.mockResolvedValue(makeUser({ isActive: false }));

    await expect(
      useCase.execute({ email: 'jane@example.com', password: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid password', async () => {
    users.findByEmail.mockResolvedValue(makeUser());
    passwords.compare.mockResolvedValue(false);

    await expect(
      useCase.execute({ email: 'jane@example.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(sessions.create).not.toHaveBeenCalled();
  });
});
