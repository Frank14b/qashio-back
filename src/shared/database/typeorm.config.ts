import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

/**
 * Single source of truth for TypeORM options, shared by the Nest app
 * (DatabaseModule) and the migration CLI (data-source.ts).
 * Schema changes go through migrations only — `synchronize` is always off.
 */
export function buildTypeOrmOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    synchronize: false,
    entities: [join(__dirname, '..', '..', 'modules', '**', '*.orm-entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    migrationsTableName: 'migrations',
    // Each migration runs in its own transaction so a failure leaves earlier ones applied.
    migrationsTransactionMode: 'each',
  };
}
