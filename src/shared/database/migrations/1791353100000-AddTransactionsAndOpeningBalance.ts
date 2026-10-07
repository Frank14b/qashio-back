import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - accounts.opening_balance (balance before the first transaction)
 * - accounts.currency_code → currencies FK
 * - (id, user_id) unique keys on accounts/categories so transactions can carry
 *   composite FKs that guarantee user_id matches the wallet and category owner
 * - transactions table: positive amount + type (income = in, expense = out),
 *   unique reference, status, counterparty
 */
export class AddTransactionsAndOpeningBalance1791353100000 implements MigrationInterface {
  name = 'AddTransactionsAndOpeningBalance1791353100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts" ADD "opening_balance" numeric(19,4) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts" ADD CONSTRAINT "UQ_accounts_id_user" UNIQUE ("id", "user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts" ADD CONSTRAINT "FK_a4cafed13e3ede137659efc9f76" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "UQ_categories_id_user" UNIQUE ("id", "user_id")`,
    );

    await queryRunner.query(
      `CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reference" character varying(32) NOT NULL, "user_id" uuid NOT NULL, "account_id" uuid NOT NULL, "category_id" uuid NOT NULL, "type" character varying(10) NOT NULL, "amount" numeric(19,4) NOT NULL, "status" character varying(12) NOT NULL DEFAULT 'completed', "counterparty" character varying(160), "narration" text, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_transactions_reference" UNIQUE ("reference"), CONSTRAINT "CHK_transactions_status" CHECK ("status" IN ('pending', 'completed', 'failed')), CONSTRAINT "CHK_transactions_type" CHECK ("type" IN ('income', 'expense')), CONSTRAINT "CHK_transactions_amount_positive" CHECK ("amount" > 0), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_user_occurred_at" ON "transactions" ("user_id", "occurred_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_account_occurred_at" ON "transactions" ("account_id", "occurred_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_user_category_occurred_at" ON "transactions" ("user_id", "category_id", "occurred_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_transactions_account_user" FOREIGN KEY ("account_id", "user_id") REFERENCES "accounts"("id","user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_transactions_category_user" FOREIGN KEY ("category_id", "user_id") REFERENCES "categories"("id","user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_category_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_account_user"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_transactions_user_category_occurred_at"`);
    await queryRunner.query(`DROP INDEX "IDX_transactions_account_occurred_at"`);
    await queryRunner.query(`DROP INDEX "IDX_transactions_user_occurred_at"`);
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "UQ_categories_id_user"`);
    await queryRunner.query(
      `ALTER TABLE "accounts" DROP CONSTRAINT "FK_a4cafed13e3ede137659efc9f76"`,
    );
    await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT "UQ_accounts_id_user"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "opening_balance"`);
  }
}
