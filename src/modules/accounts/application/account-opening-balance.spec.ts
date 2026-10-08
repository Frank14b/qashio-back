import { BadRequestException } from '@nestjs/common';
import { CreateAccountUseCase } from './create-account.use-case';
import { UpdateAccountUseCase } from './update-account.use-case';
import { inlineUnitOfWork } from '@/test-utils/unit-of-work';

describe('Account opening balance', () => {
  const accounts = {
    create: jest.fn(),
    countActiveForUser: jest.fn(),
    clearDefaultForUser: jest.fn(),
    findByIdForUser: jest.fn(),
    update: jest.fn(),
  };
  const currencies = {
    findByCode: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('on create', () => {
    const useCase = () =>
      new CreateAccountUseCase(
        accounts as never,
        currencies as never,
        { emit: jest.fn() } as never,
        inlineUnitOfWork,
      );

    it('stores a normalized opening balance (negative allowed)', async () => {
      currencies.findByCode.mockResolvedValue({ code: 'USD', decimalPlaces: 2 });
      accounts.countActiveForUser.mockResolvedValue(1);
      accounts.create.mockResolvedValue({ id: 'acc-1' });

      await useCase().execute({
        userId: 'user-1',
        name: 'Credit Card',
        currencyCode: 'USD',
        openingBalance: '-250.50',
      });

      expect(accounts.create).toHaveBeenCalledWith(
        expect.objectContaining({ openingBalance: '-250.5' }),
      );
    });

    it('rejects more decimals than the currency allows', async () => {
      currencies.findByCode.mockResolvedValue({ code: 'XAF', decimalPlaces: 0 });

      await expect(
        useCase().execute({
          userId: 'user-1',
          name: 'Cash',
          currencyCode: 'XAF',
          openingBalance: '100.5',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(accounts.create).not.toHaveBeenCalled();
    });
  });

  describe('on update', () => {
    const useCase = () =>
      new UpdateAccountUseCase(
        accounts as never,
        currencies as never,
        { emit: jest.fn() } as never,
        inlineUnitOfWork,
      );

    beforeEach(() => {
      accounts.findByIdForUser.mockResolvedValue({
        id: 'acc-1',
        currencyCode: 'USD',
        archivedAt: null,
        isArchived: false,
      });
      currencies.findByCode.mockResolvedValue({ code: 'USD', decimalPlaces: 2 });
    });

    it('accepts opening balance as the only change', async () => {
      accounts.update.mockResolvedValue({ id: 'acc-1' });

      await useCase().execute({ userId: 'user-1', accountId: 'acc-1', openingBalance: 1200.5 });

      expect(currencies.findByCode).toHaveBeenCalledWith('USD');
      expect(accounts.update).toHaveBeenCalledWith(
        'acc-1',
        expect.objectContaining({ openingBalance: '1200.5' }),
      );
    });

    it('rejects a value that exceeds the currency scale without writing', async () => {
      await expect(
        useCase().execute({ userId: 'user-1', accountId: 'acc-1', openingBalance: '1.234' }),
      ).rejects.toThrow('USD allows 2');
      expect(accounts.update).not.toHaveBeenCalled();
    });
  });
});
