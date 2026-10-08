import { Inject, Injectable } from '@nestjs/common';
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepositoryPort,
} from '../domain/ports/notification.repository.port';

@Injectable()
export class MarkNotificationsReadUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepositoryPort,
  ) {}

  /**
   * One notification when `notificationId` is given, otherwise all of the
   * user's. Idempotent and scoped to `userId`, so unknown or foreign ids are a
   * no-op rather than an error.
   */
  async execute(userId: string, notificationId?: string): Promise<void> {
    await this.notifications.markRead(userId, notificationId);
  }
}
