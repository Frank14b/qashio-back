import { Inject, Injectable } from '@nestjs/common';
import {
  ACTIVITY_LOG_REPOSITORY,
  ActivityLogRepositoryPort,
  CreateActivityLogInput,
} from '../domain/ports/activity-log.repository.port';

@Injectable()
export class RecordActivityLogUseCase {
  constructor(
    @Inject(ACTIVITY_LOG_REPOSITORY)
    private readonly activityLogs: ActivityLogRepositoryPort,
  ) {}

  async execute(input: CreateActivityLogInput): Promise<void> {
    await this.activityLogs.create(input);
  }
}
