import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - outbox_events: domain events written in the same DB transaction as the
 *   change that raised them; OutboxRelay moves pending rows (published_at
 *   NULL) to BullMQ. `dedupe_key` lets a retried emitter record an event once.
 * - notifications.event_id: source event; unique so a redelivered event
 *   stores (and emails) at most one notification.
 */
export class AddOutboxAndNotificationEventId1791600000000 implements MigrationInterface {
  name = 'AddOutboxAndNotificationEventId1791600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "event" character varying(80) NOT NULL, "payload" jsonb NOT NULL, "dedupe_key" character varying(200), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "published_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_outbox_events_dedupe_key" ON "outbox_events" ("dedupe_key") WHERE "dedupe_key" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_outbox_events_pending" ON "outbox_events" ("created_at") WHERE "published_at" IS NULL`,
    );
    await queryRunner.query(`ALTER TABLE "notifications" ADD "event_id" uuid`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_notifications_event_id" ON "notifications" ("event_id") WHERE "event_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_notifications_event_id"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "event_id"`);
    await queryRunner.query(`DROP INDEX "IDX_outbox_events_pending"`);
    await queryRunner.query(`DROP INDEX "UQ_outbox_events_dedupe_key"`);
    await queryRunner.query(`DROP TABLE "outbox_events"`);
  }
}
