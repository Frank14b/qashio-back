import { SeedCurrenciesUseCase } from './seed-currencies.use-case';
import { CURRENCY_SEED_DATA } from '../infrastructure/seed/currency.seed-data';

describe('SeedCurrenciesUseCase', () => {
  it('upserts the seed dataset by code', async () => {
    const currencies = {
      upsertMany: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new SeedCurrenciesUseCase(currencies as never);

    const result = await useCase.execute();

    expect(currencies.upsertMany).toHaveBeenCalledWith(CURRENCY_SEED_DATA);
    expect(result.upserted).toBe(CURRENCY_SEED_DATA.length);
    expect(CURRENCY_SEED_DATA.map((c) => c.code)).toEqual(
      expect.arrayContaining(['USD', 'EUR', 'XAF', 'GBP']),
    );
  });
});
