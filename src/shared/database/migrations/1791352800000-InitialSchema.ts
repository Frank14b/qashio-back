import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline: the schema as it existed when the app still used `synchronize`.
 *
 * Statements are idempotent (`IF NOT EXISTS`) and use TypeORM's generated
 * constraint/index names, so databases previously created by `synchronize`
 * simply record this migration as applied without changes.
 */
export class InitialSchema1791352800000 implements MigrationInterface {
  name = 'InitialSchema1791352800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(320) NOT NULL, "password_hash" character varying(255) NOT NULL, "display_name" character varying(120) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email")`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "auth_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "refresh_token_hash" character varying(255) NOT NULL, "user_agent" character varying(512), "ip_address" character varying(64), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_641507381f32580e8479efc36cd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_50ccaa6440288a06f0ba693ccc" ON "auth_sessions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_8ae45196f82be4540770b41ac5" ON "auth_sessions" ("refresh_token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_a4a11809dcf8cdd5fcceec774e" ON "auth_sessions" ("expires_at")`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "activity_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "action" character varying(120) NOT NULL, "resource_type" character varying(80), "resource_id" character varying(80), "metadata" jsonb, "ip_address" character varying(64), "user_agent" character varying(512), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f25287b6140c5ba18d38776a796" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_d54f841fa5478e4734590d4403" ON "activity_logs" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_879e2d305a025dadfe9929c47d" ON "activity_logs" ("action")`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "currencies" ("code" character(3) NOT NULL, "name" character varying(120) NOT NULL, "symbol" character varying(16) NOT NULL, "decimal_places" smallint NOT NULL, CONSTRAINT "PK_9f8d0972aeeb5a2277e40332d29" PRIMARY KEY ("code"))`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "currency_code" character(3) NOT NULL, "is_default" boolean NOT NULL DEFAULT false, "archived_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_3000dad1da61b29953f0747632" ON "accounts" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_accounts_user_default" ON "accounts" ("user_id") WHERE is_default = true`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "kind" character varying(20) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_2296b7fe012d95646fa41921c8" ON "categories" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_categories_user_name" ON "categories" ("user_id", "name")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP TABLE "accounts"`);
    await queryRunner.query(`DROP TABLE "currencies"`);
    await queryRunner.query(`DROP TABLE "activity_logs"`);
    await queryRunner.query(`DROP TABLE "auth_sessions"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
