import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@/modules/auth/auth.module';
import { CurrenciesModule } from '@/modules/currencies/currencies.module';
import { CreateAccountUseCase } from './application/create-account.use-case';
import { GetAccountUseCase } from './application/get-account.use-case';
import { ListAccountsUseCase } from './application/list-accounts.use-case';
import { UpdateAccountUseCase } from './application/update-account.use-case';
import { ACCOUNT_REPOSITORY } from './domain/ports/account.repository.port';
import { AccountOrmEntity } from './infrastructure/persistence/account.orm-entity';
import { TypeOrmAccountRepository } from './infrastructure/persistence/typeorm-account.repository';
import { AccountsController } from './presentation/http/accounts.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccountOrmEntity]),
    AuthModule,
    CurrenciesModule,
  ],
  controllers: [AccountsController],
  providers: [
    CreateAccountUseCase,
    ListAccountsUseCase,
    GetAccountUseCase,
    UpdateAccountUseCase,
    {
      provide: ACCOUNT_REPOSITORY,
      useClass: TypeOrmAccountRepository,
    },
  ],
  exports: [ACCOUNT_REPOSITORY],
})
export class AccountsModule {}
