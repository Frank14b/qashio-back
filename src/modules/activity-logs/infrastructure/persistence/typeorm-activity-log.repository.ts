import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from '../../domain/entities/activity-log.entity';
import {
  ActivityLogRepositoryPort,
  CreateActivityLogInput,
} from '../../domain/ports/activity-log.repository.port';
import { ActivityLogOrmEntity } from './activity-log.orm-entity';

@Injectable()
export class TypeOrmActivityLogRepository implements ActivityLogRepositoryPort {
  constructor(
    @InjectRepository(ActivityLogOrmEntity)
    private readonly logs: Repository<ActivityLogOrmEntity>,
  ) {}

  async create(input: CreateActivityLogInput): Promise<ActivityLog> {
    const row = this.logs.create({
      userId: input.userId ?? null,
      action: input.action,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
    const saved = await this.logs.save(row);
    return new ActivityLog({
      id: saved.id,
      userId: saved.userId,
      action: saved.action as CreateActivityLogInput['action'],
      resourceType: saved.resourceType,
      resourceId: saved.resourceId,
      metadata: saved.metadata,
      ipAddress: saved.ipAddress,
      userAgent: saved.userAgent,
      createdAt: saved.createdAt,
    });
  }
}
