import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Transaction } from '../domain/entities/transaction.entity';
import {
  TRANSACTION_REPOSITORY,
  TransactionRepositoryPort,
} from '../domain/ports/transaction.repository.port';

export type GetTransactionCommand = {
  userId: string;
  transactionId: string;
};

@Injectable()
export class GetTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepositoryPort,
  ) {}

  async execute(command: GetTransactionCommand): Promise<Transaction> {
    const transaction = await this.transactions.findByIdForUser(
      command.transactionId,
      command.userId,
    );
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }
}
