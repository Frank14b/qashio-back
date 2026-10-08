import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateAccountRequestDto } from '@/modules/accounts/presentation/http/dto/create-account-request.dto';
import { UpdateAccountRequestDto } from '@/modules/accounts/presentation/http/dto/update-account-request.dto';
import { CreateCategoryRequestDto } from '@/modules/categories/presentation/http/dto/create-category-request.dto';
import { UpdateTransactionRequestDto } from '@/modules/transactions/presentation/http/dto/update-transaction-request.dto';

/** Same pipeline as the global ValidationPipe: plain → instance (transforms) → validate. */
function validate<T extends object>(cls: new () => T, body: Record<string, unknown>) {
  const instance = plainToInstance(cls, body);
  const messages = validateSync(instance).flatMap((error) => Object.values(error.constraints ?? {}));
  return { instance, messages };
}

describe('request DTO validation (input shape lives in DTOs)', () => {
  describe('Trim + IsNotEmpty', () => {
    it('trims names and rejects whitespace-only ones', () => {
      expect(validate(CreateCategoryRequestDto, { name: '  Food ', kind: 'expense' })).toEqual({
        instance: expect.objectContaining({ name: 'Food' }),
        messages: [],
      });
      expect(validate(CreateCategoryRequestDto, { name: '   ', kind: 'expense' }).messages).toEqual(
        ['name should not be empty'],
      );
      expect(
        validate(CreateAccountRequestDto, { name: ' ', currencyCode: 'USD' }).messages,
      ).toEqual(['name should not be empty']);
    });

    it('canonicalizes the currency code', () => {
      expect(
        validate(CreateAccountRequestDto, { name: 'Cash', currencyCode: ' usd ' }).instance
          .currencyCode,
      ).toBe('USD');
    });
  });

  describe('RequireAtLeastOne', () => {
    it('rejects an empty account update', () => {
      expect(validate(UpdateAccountRequestDto, {}).messages).toEqual([
        'Provide at least one of: name, isDefault, archive, openingBalance',
      ]);
    });

    it('rejects an empty transaction update but accepts null to clear a field', () => {
      expect(validate(UpdateTransactionRequestDto, {}).messages).toEqual([
        expect.stringMatching(/^Provide at least one of: accountId, categoryId/),
      ]);
      expect(validate(UpdateTransactionRequestDto, { counterparty: null }).messages).toEqual([]);
      expect(validate(UpdateTransactionRequestDto, { amount: '10' }).messages).toEqual([]);
    });
  });

  describe('IsExclusiveWith', () => {
    it('rejects archive + isDefault together', () => {
      expect(validate(UpdateAccountRequestDto, { archive: true, isDefault: true }).messages).toEqual(
        ['isDefault and archive cannot both be true'],
      );
    });

    it('allows either flag alone, or restoring while setting default', () => {
      expect(validate(UpdateAccountRequestDto, { archive: true }).messages).toEqual([]);
      expect(validate(UpdateAccountRequestDto, { isDefault: true }).messages).toEqual([]);
      expect(
        validate(UpdateAccountRequestDto, { archive: false, isDefault: true }).messages,
      ).toEqual([]);
    });
  });

  it('rejects a blank name on account update', () => {
    expect(validate(UpdateAccountRequestDto, { name: '  ' }).messages).toEqual([
      'name should not be empty',
    ]);
  });
});
