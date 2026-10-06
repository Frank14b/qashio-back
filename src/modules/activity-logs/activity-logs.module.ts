import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecordActivityLogUseCase } from './application/record-activity-log.use-case';
import { ACTIVITY_LOG_REPOSITORY } from './domain/ports/activity-log.repository.port';
import { TypeOrmActivityLogRepository } from './infrastructure/persistence/typeorm-activity-log.repository';
import { ActivityLogOrmEntity } from './infrastructure/persistence/activity-log.orm-entity';
import { ActivityLogInterceptor } from './presentation/interceptors/activity-log.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([ActivityLogOrmEntity])],
  providers: [
    RecordActivityLogUseCase,
    ActivityLogInterceptor,
    {
      provide: ACTIVITY_LOG_REPOSITORY,
      useClass: TypeOrmActivityLogRepository,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityLogInterceptor,
    },
  ],
  exports: [RecordActivityLogUseCase, ActivityLogInterceptor],
})
export class ActivityLogsModule {}
