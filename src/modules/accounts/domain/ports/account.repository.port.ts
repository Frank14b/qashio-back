import { Account } from '../entities/account.entity';

export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');

export type CreateAccountInput = {
  userId: string;
  name: string;
  currencyCode: string;
  isDefault: boolean;
};

export type UpdateAccountInput = {
  name?: string;
  isDefault?: boolean;
  archivedAt?: Date | null;
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
  findMany(query: ListAccountsQuery): Promise<Account[]>;
  findNamesByUserId(userId: string): Promise<Set<string>>;
  countActiveForUser(userId: string): Promise<number>;
  clearDefaultForUser(userId: string): Promise<void>;
  update(id: string, input: UpdateAccountInput): Promise<Account>;
}
