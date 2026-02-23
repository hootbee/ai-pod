import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { TokenPayload } from '../interfaces/token.service.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TokenPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: TokenPayload }>();
    return request.user;
  },
);
