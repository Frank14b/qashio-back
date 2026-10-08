import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'notifications' })
@Index('IDX_notifications_user_created_at', ['userId', 'createdAt'])
// Small partial index behind the unread badge count.
@Index('IDX_notifications_user_unread', ['userId'], { where: 'read_at IS NULL' })
// One notification per source event, however often the event is delivered.
@Index('UQ_notifications_event_id', ['eventId'], { unique: true, where: '"event_id" IS NOT NULL' })
export class NotificationOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 40 })
  type!: string;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'jsonb', default: {} })
  data!: Record<string, string>;

  @Column({ name: 'event_id', type: 'uuid', nullable: true })
  eventId!: string | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
