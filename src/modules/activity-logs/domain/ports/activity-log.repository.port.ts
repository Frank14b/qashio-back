import { ActivityLog } from '../entities/activity-log.entity';
import { ActivityAction } from '../activity-action.enum';

export const ACTIVITY_LOG_REPOSITORY = Symbol('ACTIVITY_LOG_REPOSITORY');

export type CreateActivityLogInput = {
  userId?: string | null;
  action: ActivityAction;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export interface ActivityLogRepositoryPort {
  create(input: CreateActivityLogInput): Promise<ActivityLog>;
}
