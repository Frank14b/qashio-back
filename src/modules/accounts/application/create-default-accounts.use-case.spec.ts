import { BadRequestException } from '@nestjs/common';
import { CreateDefaultAccountsUseCase } from './create-default-accounts.use-case';
import { DEFAULT_ACCOUNT_SEEDS } from './default-accounts';

describe('CreateDefaultAccountsUseCase', () => {
  const accounts = {
    findNamesByUserId: jest.fn(),
    createMany: jest.fn(),
    clearDefaultForUser: jest.fn(),
  };
  const currencies = {
    findByCode: jest.fn(),
  };
  let useCase: CreateDefaultAccountsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    currencies.findByCode.mockResolvedValue({ code: 'USD' });
    useCase = new CreateDefaultAccountsUseCase(accounts as never, currencies as never);
  });

  it('creates all defaults when the user has none', async () => {
    accounts.findNamesByUserId.mockResolvedValue(new Set());
    accounts.createMany.mockImplementation(async (inputs: unknown[]) => inputs);

    const result = await useCase.execute({ userId: 'user-1' });

    expect(accounts.clearDefaultForUser).toHaveBeenCalledWith('user-1');
    expect(accounts.createMany).toHaveBeenCalledWith(
      DEFAULT_ACCOUNT_SEEDS.map((seed) => ({
        userId: 'user-1',
        name: seed.name,
        currencyCode: seed.currencyCode,
        isDefault: seed.isDefault,
      })),
    );
    expect(result).toHaveLength(DEFAULT_ACCOUNT_SEEDS.length);
  });

  it('is idempotent and only inserts missing names', async () => {
    accounts.findNamesByUserId.mockResolvedValue(new Set(['Cash']));
    accounts.createMany.mockResolvedValue([{ name: 'Bank' }]);

    await useCase.execute({ userId: 'user-1' });

    const created = accounts.createMany.mock.calls[0][0] as Array<{ name: string }>;
    expect(created.map((a) => a.name)).not.toContain('Cash');
    expect(created.map((a) => a.name)).toContain('Bank');
    expect(created.map((a) => a.name)).toContain('Credit Card');
    expect(accounts.clearDefaultForUser).not.toHaveBeenCalled();
  });

  it('skips createMany when all defaults already exist', async () => {
    accounts.findNamesByUserId.mockResolvedValue(
      new Set(DEFAULT_ACCOUNT_SEEDS.map((s) => s.name)),
    );

    const result = await useCase.execute({ userId: 'user-1' });

    expect(accounts.createMany).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('rejects when a seed currency is unknown', async () => {
    accounts.findNamesByUserId.mockResolvedValue(new Set());
    currencies.findByCode.mockResolvedValue(null);

    await expect(useCase.execute({ userId: 'user-1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(accounts.createMany).not.toHaveBeenCalled();
  });
});
