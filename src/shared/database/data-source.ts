import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { baseEnvSchema, parseEnv } from '../config/env';
import { buildTypeOrmOptions } from './typeorm.config';

// TypeORM CLI entry point (`npm run migration:*`). Outside Nest, so load `.env`
// ourselves; variables already set in the environment (Docker) take precedence.
const envFile = join(process.cwd(), '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

// Migrations only need the database, not the app's secrets (JWT, SMTP…).
const { DATABASE_URL } = parseEnv(process.env, baseEnvSchema.pick({ DATABASE_URL: true }));

export default new DataSource(buildTypeOrmOptions(DATABASE_URL));
