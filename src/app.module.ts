import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AccountsModule } from '@/modules/accounts/accounts.module';
import { ActivityLogsModule } from '@/modules/activity-logs/activity-logs.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { CurrenciesModule } from '@/modules/currencies/currencies.module';
import { UsersModule } from '@/modules/users/users.module';
import { DomainEventsModule } from '@/shared/events/domain-events.module';
import { SharedModule } from '@/shared/shared.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    DomainEventsModule,
    SharedModule,
    UsersModule,
    ActivityLogsModule,
    AuthModule,
    CurrenciesModule,
    AccountsModule,
    CategoriesModule,
  ],
})
export class AppModule {}
