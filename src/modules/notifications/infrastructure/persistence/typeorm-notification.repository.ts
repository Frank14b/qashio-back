import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { Notification } from '../../domain/entities/notification.entity';
import { NotificationType } from '../../domain/notification-type';
import {
  CreateNotificationInput,
  NotificationRepositoryPort,
} from '../../domain/ports/notification.repository.port';
import { NotificationOrmEntity } from './notification.orm-entity';

@Injectable()
export class TypeOrmNotificationRepository implements NotificationRepositoryPort {
  constructor(
    @InjectRepository(NotificationOrmEntity)
    private readonly notifications: Repository<NotificationOrmEntity>,
  ) {}

  async create(input: CreateNotificationInput): Promise<Notification | null> {
    const result = await this.notifications
      .createQueryBuilder()
      .insert()
      .values({ ...input, eventId: input.eventId ?? null })
      // Conflict on UQ_notifications_event_id: this event was already handled.
      .orIgnore()
      .returning(['id'])
      .execute();
    const inserted = (result.raw as { id: string }[])[0];
    if (!inserted) {
      return null;
    }
    return this.toDomain(await this.notifications.findOneByOrFail({ id: inserted.id }));
  }

  async findRecent(
    userId: string,
    options: { limit: number; unreadOnly: boolean },
  ): Promise<Notification[]> {
    const rows = await this.notifications.find({
      where: options.unreadOnly ? { userId, readAt: IsNull() } : { userId },
      order: { createdAt: 'DESC' },
      take: options.limit,
    });
    return rows.map((row) => this.toDomain(row));
  }

  countUnread(userId: string): Promise<number> {
    return this.notifications.count({ where: { userId, readAt: IsNull() } });
  }

  async markRead(userId: string, id?: string): Promise<void> {
    const where: FindOptionsWhere<NotificationOrmEntity> = { userId, readAt: IsNull() };
    if (id) {
      where.id = id;
    }
    await this.notifications.update(where, { readAt: new Date() });
  }

  private toDomain(row: NotificationOrmEntity): Notification {
    return new Notification({
      id: row.id,
      userId: row.userId,
      type: row.type as NotificationType,
      title: row.title,
      message: row.message,
      data: row.data,
      readAt: row.readAt,
      createdAt: row.createdAt,
    });
  }
}
