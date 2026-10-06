import { ConflictException } from '@nestjs/common';
import {
  makePasswordHasher,
  makeSession,
  makeSessionRepository,
  makeTokenService,
  makeUser,
  makeUserRepository,
} from '@/test-utils/auth-fixtures';
import { RegisterUserUseCase } from './register-user.use-case';

describe('RegisterUserUseCase', () => {
  const users = makeUserRepository();
  const sessions = makeSessionRepository();
  const passwords = makePasswordHasher();
  const tokens = makeTokenService();
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new RegisterUserUseCase(
      users as never,
      sessions as never,
      passwords as never,
      tokens as never,
    );
  });

  it('registers a user, opens a session, and returns tokens', async () => {
    const user = makeUser({ email: 'jane@example.com', displayName: 'Jane' });
    const session = makeSession({ userId: user.id });
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue(user);
    sessions.create.mockResolvedValue(session);

    const result = await useCase.execute({
      email: '  Jane@Example.com ',
      password: 'Secret123!',
      displayName: '  Jane  ',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(users.findByEmail).toHaveBeenCalledWith('jane@example.com');
    expect(passwords.hash).toHaveBeenCalledWith('Secret123!');
    expect(users.create).toHaveBeenCalledWith({
      email: 'jane@example.com',
      passwordHash: 'hashed:Secret123!',
      displayName: 'Jane',
    });
    expect(sessions.create).toHaveBeenCalledWith({
      userId: user.id,
      refreshTokenHash: 'hash:refresh-token',
      userAgent: 'jest',
      ipAddress: '127.0.0.1',
      expiresAt: tokens.getRefreshExpiresAt(),
    });
    expect(tokens.signAccessToken).toHaveBeenCalledWith({
      sub: user.id,
      sid: session.id,
      email: user.email,
    });
    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
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
  });
});
