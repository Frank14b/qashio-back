import { BadRequestException } from '@nestjs/common';
import { CreateAccountUseCase } from './create-account.use-case';

describe('CreateAccountUseCase', () => {
  const accounts = {
    create: jest.fn(),
    countActiveForUser: jest.fn(),
    clearDefaultForUser: jest.fn(),
  };
  const currencies = {
    findByCode: jest.fn(),
  };
  let useCase: CreateAccountUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CreateAccountUseCase(accounts as never, currencies as never);
  });

  it('creates an account when currency exists', async () => {
    currencies.findByCode.mockResolvedValue({ code: 'USD' });
    accounts.countActiveForUser.mockResolvedValue(1);
    accounts.create.mockResolvedValue({
      id: 'acc-1',
      userId: 'user-1',
      name: 'Cash',
      currencyCode: 'USD',
      isDefault: false,
    });

    const result = await useCase.execute({
      userId: 'user-1',
      name: 'Cash',
      currencyCode: 'usd',
      isDefault: false,
    });

    expect(currencies.findByCode).toHaveBeenCalledWith('USD');
    expect(accounts.clearDefaultForUser).not.toHaveBeenCalled();
    expect(accounts.create).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Cash',
      currencyCode: 'USD',
      isDefault: false,
    });
    expect(result.id).toBe('acc-1');
  });

  it('forces default on first active wallet', async () => {
    currencies.findByCode.mockResolvedValue({ code: 'EUR' });
    accounts.countActiveForUser.mockResolvedValue(0);
    accounts.create.mockResolvedValue({ id: 'acc-1', isDefault: true });

    await useCase.execute({
      userId: 'user-1',
      name: 'Main',
      currencyCode: 'EUR',
    });

    expect(accounts.clearDefaultForUser).toHaveBeenCalledWith('user-1');
    expect(accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ isDefault: true }),
    );
  });

  it('rejects unknown currency', async () => {
    currencies.findByCode.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId: 'user-1',
        name: 'Cash',
        currencyCode: 'ZZZ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(accounts.create).not.toHaveBeenCalled();
  });
});
