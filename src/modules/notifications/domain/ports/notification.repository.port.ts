import { Notification, NotificationData } from '../entities/notification.entity';
import { NotificationType } from '../notification-type';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: NotificationData;
};

export interface NotificationRepositoryPort {
  create(input: CreateNotificationInput): Promise<Notification>;
  /** Newest first. */
  findRecent(userId: string, options: { limit: number; unreadOnly: boolean }): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  /** Marks one (when `id` is given) or all of the user's unread notifications read. */
  markRead(userId: string, id?: string): Promise<void>;
}
