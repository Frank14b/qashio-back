import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Transactional outbox: a domain event written in the same DB transaction as
 * the change that raised it. OutboxRelay moves pending rows to the BullMQ queue.
 */
@Entity({ name: 'outbox_events' })
// What the relay scans: small, since published rows drop out of it.
@Index('IDX_outbox_events_pending', ['createdAt'], { where: '"published_at" IS NULL' })
// Lets an emitter that may run twice (a retried handler) record an event only once.
@Index('UQ_outbox_events_dedupe_key', ['dedupeKey'], {
  unique: true,
  where: '"dedupe_key" IS NOT NULL',
})
export class OutboxEventOrmEntity {
  /** Also the event id handlers receive; part of every BullMQ job id. */
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 80 })
  event!: string;

  @Column({ type: 'jsonb' })
  payload!: unknown;

  @Column({ name: 'dedupe_key', type: 'varchar', length: 200, nullable: true })
  dedupeKey!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /** Set once every handler job is in Redis; NULL = still to relay. */
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;
}
