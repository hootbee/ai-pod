import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_METADATA = 'audit_action';

export const AuditAction = (action: string): MethodDecorator =>
  SetMetadata(AUDIT_ACTION_METADATA, action);
