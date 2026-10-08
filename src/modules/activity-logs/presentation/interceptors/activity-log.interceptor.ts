import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, from, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { RecordActivityLogUseCase } from '../../application/record-activity-log.use-case';
import {
  LOG_ACTIVITY_KEY,
  LogActivityOptions,
} from '../decorators/log-activity.decorator';

function getByPath(value: unknown, path?: string): string | null {
  if (!path || value == null || typeof value !== 'object') {
    return null;
  }
  const resolved = path.split('.').reduce<unknown>((current, key) => {
    if (current == null || typeof current !== 'object') {
      return null;
    }
    return (current as Record<string, unknown>)[key];
  }, value);
  return typeof resolved === 'string' ? resolved : null;
}

type AuthenticatedRequest = Request & {
  user?: { sub?: string; id?: string };
  /** Request id assigned by pino-http (LoggingModule). */
  id?: string;
};

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly recordActivityLog: RecordActivityLogUseCase,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<LogActivityOptions | undefined>(
      LOG_ACTIVITY_KEY,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const ipAddress = req.ip ?? null;
    const userAgent = req.headers['user-agent'] ?? null;

    return next.handle().pipe(
      switchMap((data) =>
        from(
          this.recordActivityLog.execute({
            action: options.action,
            userId:
              getByPath(data, options.userIdFrom) ??
              req.user?.sub ??
              req.user?.id ??
              null,
            resourceType: options.resourceType ?? null,
            resourceId: getByPath(data, options.resourceIdFrom),
            ipAddress,
            userAgent,
            metadata: req.id ? { requestId: req.id } : null,
          }),
        ).pipe(switchMap(() => of(options.emptyResponse ? undefined : data))),
      ),
    );
  }
}
