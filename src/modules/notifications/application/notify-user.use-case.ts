import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '@/modules/users/domain/ports/user.repository.port';
import {
  EMAIL_SENDER,
  EmailSenderPort,
} from '@/shared/email/domain/ports/email-sender.port';
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepositoryPort,
} from '../domain/ports/notification.repository.port';
import { NotificationDraft } from './notification-content';

/**
 * Stores the in-app notification first (source of truth), then sends the
 * email when requested. Email is best-effort: a mail outage must not lose
 * the notification or break the event that triggered it.
 */
@Injectable()
export class NotifyUserUseCase {
  private readonly logger = new Logger(NotifyUserUseCase.name);

  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepositoryPort,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(EMAIL_SENDER) private readonly emails: EmailSenderPort,
  ) {}

  async execute({ email, ...notification }: NotificationDraft): Promise<void> {
    const created = await this.notifications.create(notification);
    // null: a replay of an event already notified (and emailed, if it was an alert).
    if (created === null || !email) {
      return;
    }

    try {
      const user = await this.users.findById(notification.userId);
      if (!user?.isActive) {
        return;
      }
      // Text-only on purpose: titles contain user input (category names).
      await this.emails.send({
        to: user.email,
        subject: notification.title,
        text: `Hi ${user.displayName},\n\n${notification.message}\n\n— Qashio`,
      });
    } catch (error) {
      this.logger.error(
        `Failed to email notification "${notification.type}" to user ${notification.userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
