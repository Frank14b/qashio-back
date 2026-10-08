import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { parseEnv } from '../config/env';
import { buildTypeOrmOptions } from './typeorm.config';

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
  ],
})
export class DatabaseModule {}
