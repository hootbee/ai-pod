import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { TokenPayload } from '../interfaces/token.service.interface';
import { UserRole } from '../../users/entities/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.getRequiredRoles(context);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: TokenPayload }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('User context is required');

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Admin role is required');
    }

    // Explicitly guard against malformed token payloads.
    if (user.role !== UserRole.ADMIN && requiredRoles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('Admin role is required');
    }

    return true;
  }

  private getRequiredRoles(context: ExecutionContext): UserRole[] {
    const handlerRoles = Reflect.getMetadata(ROLES_KEY, context.getHandler()) as UserRole[] | undefined;
    const classRoles = Reflect.getMetadata(ROLES_KEY, context.getClass()) as UserRole[] | undefined;
    return handlerRoles ?? classRoles ?? [];
  }
}
