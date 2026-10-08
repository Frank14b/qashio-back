import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { ClsModule } from 'nestjs-cls';
import { parseEnv } from '../config/env';
import { ClsUnitOfWork } from './transaction-host';
import { buildTypeOrmOptions } from './typeorm.config';
import { UNIT_OF_WORK } from './unit-of-work.port';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      // Same zod schema as instrument.ts; ConfigService then returns typed values.
      validate: parseEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...buildTypeOrmOptions(config.getOrThrow<string>('DATABASE_URL')),
        // Entities come from TypeOrmModule.forFeature; migrations are applied by
        // `npm run migration:run` (Docker entrypoint), never on app boot.
        entities: [],
        autoLoadEntities: true,
        migrationsRun: false,
      }),
    }),
    // Shares one transaction across repositories (AsyncLocalStorage), see UnitOfWorkPort.
    ClsModule.forRoot({
      global: true,
      plugins: [
        new ClsPluginTransactional({
          imports: [TypeOrmModule],
          adapter: new TransactionalAdapterTypeOrm({ dataSourceToken: getDataSourceToken() }),
        }),
      ],
    }),
  ],
  providers: [{ provide: UNIT_OF_WORK, useClass: ClsUnitOfWork }],
  exports: [UNIT_OF_WORK],
})
export class DatabaseModule {}
