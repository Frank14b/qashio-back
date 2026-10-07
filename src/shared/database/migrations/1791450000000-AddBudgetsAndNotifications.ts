import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - budgets: spending limit per category, wallet and period (currency is the
 *   wallet's); composite FKs keep category/wallet owned by the same user and
 *   a unique index allows one budget per scope
 * - notifications: in-app feed fed by transaction / budget / account events
 */
export class AddBudgetsAndNotifications1791450000000 implements MigrationInterface {
  name = 'AddBudgetsAndNotifications1791450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "budgets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "category_id" uuid NOT NULL, "account_id" uuid NOT NULL, "amount" numeric(19,4) NOT NULL, "period" character varying(10) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_budgets_period" CHECK ("period" IN ('weekly', 'monthly', 'yearly')), CONSTRAINT "CHK_budgets_amount_positive" CHECK ("amount" > 0), CONSTRAINT "PK_9c8a51748f82387644b773da482" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_budgets_scope" ON "budgets" ("user_id", "category_id", "account_id", "period")`,
    );
    await queryRunner.query(
      `ALTER TABLE "budgets" ADD CONSTRAINT "FK_budgets_category_user" FOREIGN KEY ("category_id", "user_id") REFERENCES "categories"("id","user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "budgets" ADD CONSTRAINT "FK_budgets_account_user" FOREIGN KEY ("account_id", "user_id") REFERENCES "accounts"("id","user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "type" character varying(40) NOT NULL, "title" character varying(160) NOT NULL, "message" text NOT NULL, "data" jsonb NOT NULL DEFAULT '{}', "read_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_created_at" ON "notifications" ("user_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_unread" ON "notifications" ("user_id") WHERE read_at IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_notifications_user_unread"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_user_created_at"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`ALTER TABLE "budgets" DROP CONSTRAINT "FK_budgets_account_user"`);
    await queryRunner.query(`ALTER TABLE "budgets" DROP CONSTRAINT "FK_budgets_category_user"`);
    await queryRunner.query(`DROP INDEX "UQ_budgets_scope"`);
    await queryRunner.query(`DROP TABLE "budgets"`);
  }
}
