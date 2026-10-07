import { Inject, Injectable } from '@nestjs/common';
import { Notification } from '../domain/entities/notification.entity';
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepositoryPort,
} from '../domain/ports/notification.repository.port';

export type GetNotificationsQuery = {
  userId: string;
  limit: number;
  unreadOnly: boolean;
};

@Injectable()
export class GetNotificationsUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepositoryPort,
  ) {}

  async execute(
    query: GetNotificationsQuery,
  ): Promise<{ items: Notification[]; unreadCount: number }> {
    const [items, unreadCount] = await Promise.all([
      this.notifications.findRecent(query.userId, query),
      this.notifications.countUnread(query.userId),
    ]);
    return { items, unreadCount };
  }
}
