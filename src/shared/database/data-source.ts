import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from './typeorm.config';

// TypeORM CLI entry point (`npm run migration:*`). Outside Nest, so load `.env`
// ourselves; variables already set in the environment (Docker) take precedence.
const envFile = join(process.cwd(), '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is required to run migrations');
}

export default new DataSource(buildTypeOrmOptions(url));