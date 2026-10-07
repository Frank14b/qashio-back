import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Account } from '../domain/entities/account.entity';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../domain/ports/account.repository.port';

export type UpdateAccountCommand = {
  userId: string;
  accountId: string;
  name?: string;
  isDefault?: boolean;
  archive?: boolean;
};

@Injectable()
export class UpdateAccountUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
  ) {}

  async execute(command: UpdateAccountCommand): Promise<Account> {
    const existing = await this.accounts.findByIdForUser(
      command.accountId,
      command.userId,
    );
    if (!existing) {
      throw new NotFoundException('Account not found');
    }

    if (
      command.name === undefined &&
      command.isDefault === undefined &&
      command.archive === undefined
    ) {
      throw new BadRequestException('No updates provided');
    }

    const name =
      command.name !== undefined ? command.name.trim() : undefined;
    if (name !== undefined && !name) {
      throw new BadRequestException('Account name is required');
    }

    if (command.archive === true && command.isDefault === true) {
      throw new BadRequestException('Cannot archive and set as default');
    }

    if (command.isDefault === true && existing.isArchived && command.archive !== false) {
      throw new BadRequestException('Cannot set an archived account as default');
    }

    if (command.isDefault === true) {
      await this.accounts.clearDefaultForUser(command.userId);
    }

    let archivedAt: Date | null | undefined;
    if (command.archive === true) {
      archivedAt = existing.archivedAt ?? new Date();
    } else if (command.archive === false) {
      archivedAt = null;
    }

    return this.accounts.update(command.accountId, {
      name,
      isDefault: command.isDefault,
      archivedAt,
    });
  }
}
