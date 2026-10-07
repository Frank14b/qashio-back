import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * transactions.idempotency_key: the client's `Idempotency-Key` for the create
 * request. Unique per user (when set) so a retried or double-sent create can
 * never insert a second row; existing rows stay NULL.
 */
export class AddTransactionIdempotencyKey1791540000000 implements MigrationInterface {
  name = 'AddTransactionIdempotencyKey1791540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transactions" ADD "idempotency_key" uuid`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_transactions_user_idempotency_key" ON "transactions" ("user_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_transactions_user_idempotency_key"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "idempotency_key"`);
  }
}
