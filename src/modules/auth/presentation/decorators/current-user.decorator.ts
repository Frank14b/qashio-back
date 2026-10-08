import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AccessTokenPayload } from '../../domain/ports/token.service.port';
import { AuthenticatedRequest } from '../guards/jwt-auth.guard';

export type AccessTokenUser = AccessTokenPayload;

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user as AccessTokenUser;
  },
);
