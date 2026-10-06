import { ActivityAction } from '../activity-action.enum';

export type ActivityLogProps = {
  id: string;
  userId: string | null;
  action: ActivityAction;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

export class ActivityLog {
  readonly id: string;
  readonly userId: string | null;
  readonly action: ActivityAction;
  readonly resourceType: string | null;
  readonly resourceId: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly createdAt: Date;

  constructor(props: ActivityLogProps) {
    Object.assign(this, props);
  }
}
