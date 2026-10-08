import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@/modules/auth/auth.module';
import { UsersModule } from '@/modules/users/users.module';
import { GetNotificationsUseCase } from './application/get-notifications.use-case';
import { DomainEventsListener } from './application/listeners/domain-events.listener';
import { MarkNotificationsReadUseCase } from './application/mark-notifications-read.use-case';
import { NotifyUserUseCase } from './application/notify-user.use-case';
import { NOTIFICATION_REPOSITORY } from './domain/ports/notification.repository.port';
import { NotificationOrmEntity } from './infrastructure/persistence/notification.orm-entity';
import { TypeOrmNotificationRepository } from './infrastructure/persistence/typeorm-notification.repository';
import { NotificationsController } from './presentation/http/notifications.controller';

/** Consumes transaction, budget and account events; owns in-app + email delivery. */
@Module({
  imports: [TypeOrmModule.forFeature([NotificationOrmEntity]), AuthModule, UsersModule],
  controllers: [NotificationsController],
  providers: [
    NotifyUserUseCase,
    GetNotificationsUseCase,
    MarkNotificationsReadUseCase,
    DomainEventsListener,
    {
      provide: NOTIFICATION_REPOSITORY,
      useClass: TypeOrmNotificationRepository,
    },
  ],
})
export class NotificationsModule {}
