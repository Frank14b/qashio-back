import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AccountsModule } from '@/modules/accounts/accounts.module';
import { ActivityLogsModule } from '@/modules/activity-logs/activity-logs.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { CurrenciesModule } from '@/modules/currencies/currencies.module';
import { HealthModule } from '@/modules/health/health.module';
import { BudgetsModule } from '@/modules/budgets/budgets.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { TransactionsModule } from '@/modules/transactions/transactions.module';
import { UsersModule } from '@/modules/users/users.module';
import { DomainEventsModule } from '@/shared/events/domain-events.module';
import { SharedModule } from '@/shared/shared.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    DomainEventsModule,
    SharedModule,
    HealthModule,
    UsersModule,
    ActivityLogsModule,
    AuthModule,
    CurrenciesModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    BudgetsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
