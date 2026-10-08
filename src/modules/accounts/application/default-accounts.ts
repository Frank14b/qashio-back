export type DefaultAccountSeed = {
  name: string;
  currencyCode: string;
  isDefault: boolean;
};

/**
 * Starter wallets created after email verification (idempotent by name).
 * Users can rename / set default / archive later via account APIs.
 */
export const DEFAULT_ACCOUNT_SEEDS: DefaultAccountSeed[] = [
  { name: 'Cash', currencyCode: 'USD', isDefault: true },
  { name: 'Bank', currencyCode: 'USD', isDefault: false },
  { name: 'Credit Card', currencyCode: 'USD', isDefault: false },
];
