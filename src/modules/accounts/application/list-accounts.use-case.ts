import { Inject, Injectable } from '@nestjs/common';
import { Account } from '../domain/entities/account.entity';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../domain/ports/account.repository.port';

export type ListAccountsCommand = {
  userId: string;
  includeArchived?: boolean;
};

@Injectable()
export class ListAccountsUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
  ) {}

  execute(command: ListAccountsCommand): Promise<Account[]> {
    return this.accounts.findMany({
      userId: command.userId,
      includeArchived: command.includeArchived ?? false,
    });
  }
}
