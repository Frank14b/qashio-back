import { SetMetadata } from '@nestjs/common';
import { ActivityAction } from '../../domain/activity-action.enum';

export const LOG_ACTIVITY_KEY = 'log_activity';

export type LogActivityOptions = {
  action: ActivityAction;
  /** e.g. `user`, `auth_session` */
  resourceType?: string;
  /**
   * Dot path on the handler response for `userId`.
   * Falls back to `req.user.sub` / `req.user.id` when omitted or missing.
   * Example: `user.id`
   */
  userIdFrom?: string;
  /** Dot path on the handler response for `resourceId`. Example: `user.id` */
  resourceIdFrom?: string;
  /** When true, replace the response body with `undefined` (e.g. 204 logout). */
  emptyResponse?: boolean;
};

export const LogActivity = (options: LogActivityOptions) =>
  SetMetadata(LOG_ACTIVITY_KEY, options);
