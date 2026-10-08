import { Account } from '../entities/account.entity';

export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');

export type CreateAccountInput = {
  userId: string;
  name: string;
  currencyCode: string;
  isDefault: boolean;
  /** Normalized decimal string; defaults to `0` */
  openingBalance?: string;
};

export type UpdateAccountInput = {
  name?: string;
  isDefault?: boolean;
  archivedAt?: Date | null;
  openingBalance?: string;
};

export type ListAccountsQuery = {
  userId: string;
  includeArchived?: boolean;
};

export interface AccountRepositoryPort {
  create(input: CreateAccountInput): Promise<Account>;
  createMany(inputs: CreateAccountInput[]): Promise<Account[]>;
  findById(id: string): Promise<Account | null>;
  findByIdForUser(id: string, userId: string): Promise<Account | null>;
  findDefaultForUser(userId: string): Promise<Account | null>;
  findMany(query: ListAccountsQuery): Promise<Account[]>;
  findNamesByUserId(userId: string): Promise<Set<string>>;
  countActiveForUser(userId: string): Promise<number>;
  clearDefaultForUser(userId: string): Promise<void>;
  update(id: string, input: UpdateAccountInput): Promise<Account>;
  /**
   * Current balance per account: `opening_balance + Σ completed income − Σ completed expense`.
   * Returned as raw decimal strings keyed by account id (missing ids are omitted).
   */
  getBalances(userId: string, accountIds: string[]): Promise<Map<string, string>>;
}
