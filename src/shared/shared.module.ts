import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email/email.module';
import { HttpExceptionFilter } from './http/http-exception.filter';
import { RedisModule } from './redis/redis.module';

@Global()
@Module({
  imports: [DatabaseModule, RedisModule, EmailModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
  exports: [DatabaseModule, RedisModule, EmailModule],
})
export class SharedModule {}
