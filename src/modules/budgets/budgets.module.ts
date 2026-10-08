import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsModule } from '@/modules/accounts/accounts.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { CurrenciesModule } from '@/modules/currencies/currencies.module';
import { CreateBudgetsUseCase } from './application/create-budgets.use-case';
import { DeleteBudgetUseCase } from './application/delete-budget.use-case';
import { EvaluateBudgetThresholdsUseCase } from './application/evaluate-budget-thresholds.use-case';
import { GetBudgetsUseCase } from './application/get-budgets.use-case';
import { TransactionEventsListener } from './application/listeners/transaction-events.listener';
import { UpdateBudgetUseCase } from './application/update-budget.use-case';
import { BUDGET_REPOSITORY } from './domain/ports/budget.repository.port';
import { BudgetOrmEntity } from './infrastructure/persistence/budget.orm-entity';
import { TypeOrmBudgetRepository } from './infrastructure/persistence/typeorm-budget.repository';
import { BudgetsController } from './presentation/http/budgets.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([BudgetOrmEntity]),
    AuthModule,
    AccountsModule,
    CategoriesModule,
    CurrenciesModule,
  ],
  controllers: [BudgetsController],
  providers: [
    CreateBudgetsUseCase,
    GetBudgetsUseCase,
    UpdateBudgetUseCase,
    DeleteBudgetUseCase,
    EvaluateBudgetThresholdsUseCase,
    TransactionEventsListener,
    {
      provide: BUDGET_REPOSITORY,
      useClass: TypeOrmBudgetRepository,
    },
  ],
})
export class BudgetsModule {}
