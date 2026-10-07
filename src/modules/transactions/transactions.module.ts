import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsModule } from '@/modules/accounts/accounts.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { CurrenciesModule } from '@/modules/currencies/currencies.module';
import { CreateTransactionUseCase } from './application/create-transaction.use-case';
import { DeleteTransactionUseCase } from './application/delete-transaction.use-case';
import { GetTransactionUseCase } from './application/get-transaction.use-case';
import { ListTransactionsUseCase } from './application/list-transactions.use-case';
import { SummarizeTransactionsUseCase } from './application/summarize-transactions.use-case';
import { TransactionRules } from './application/transaction-rules';
import { UpdateTransactionUseCase } from './application/update-transaction.use-case';
import { TRANSACTION_REPOSITORY } from './domain/ports/transaction.repository.port';
import { TransactionOrmEntity } from './infrastructure/persistence/transaction.orm-entity';
import { TypeOrmTransactionRepository } from './infrastructure/persistence/typeorm-transaction.repository';
import { TransactionsController } from './presentation/http/transactions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionOrmEntity]),
    AuthModule,
    AccountsModule,
    CategoriesModule,
    CurrenciesModule,
  ],
  controllers: [TransactionsController],
  providers: [
    TransactionRules,
    CreateTransactionUseCase,
    ListTransactionsUseCase,
    GetTransactionUseCase,
    UpdateTransactionUseCase,
    DeleteTransactionUseCase,
    SummarizeTransactionsUseCase,
    {
      provide: TRANSACTION_REPOSITORY,
      useClass: TypeOrmTransactionRepository,
    },
  ],
  exports: [TRANSACTION_REPOSITORY],
})
export class TransactionsModule {}
