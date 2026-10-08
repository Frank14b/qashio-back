import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email/email.module';
import { HttpExceptionFilter } from './http/http-exception.filter';
import { LoggingModule } from './logging/logging.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { RedisModule } from './redis/redis.module';

@Global()
@Module({
  imports: [LoggingModule, DatabaseModule, RedisModule, EmailModule, RateLimitModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
  exports: [DatabaseModule, RedisModule, EmailModule],
})
export class SharedModule {}
