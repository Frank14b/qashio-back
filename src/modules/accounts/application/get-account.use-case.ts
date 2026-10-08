import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Account } from '../domain/entities/account.entity';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../domain/ports/account.repository.port';

export type GetAccountCommand = {
  userId: string;
  accountId: string;
};

@Injectable()
export class GetAccountUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
  ) {}

  async execute(command: GetAccountCommand): Promise<Account> {
    const account = await this.accounts.findByIdForUser(
      command.accountId,
      command.userId,
    );
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }
}
