import { Notification, NotificationData } from '../entities/notification.entity';
import { NotificationType } from '../notification-type';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: NotificationData;
  /** Source domain event; a second notification for the same event is not stored. */
  eventId?: string;
};

export interface NotificationRepositoryPort {
  /** Returns null when a notification for `eventId` already exists (a replayed event). */
  create(input: CreateNotificationInput): Promise<Notification | null>;
  /** Newest first. */
  findRecent(userId: string, options: { limit: number; unreadOnly: boolean }): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  /** Marks one (when `id` is given) or all of the user's unread notifications read. */
  markRead(userId: string, id?: string): Promise<void>;
}
