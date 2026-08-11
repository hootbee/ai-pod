import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { AuthAuditEventType, AuthAuditLog } from './entities/auth-audit-log.entity';

export interface AuthAuditContext {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  deviceId?: string;
}

export interface AuthAuditInput extends AuthAuditContext {
  userId?: string | null;
  eventType: AuthAuditEventType;
  provider?: string | null;
  failureReason?: string | null;
}

@Injectable()
export class AuthAuditService {
  private readonly logger = new Logger(AuthAuditService.name);

  constructor(
    @InjectRepository(AuthAuditLog)
    private readonly repository: Repository<AuthAuditLog>,
  ) {}

  async record(input: AuthAuditInput): Promise<void> {
    try {
      await this.repository.save(
        this.repository.create({
          userId: input.userId ?? null,
          eventType: input.eventType,
          provider: input.provider ?? null,
          failureReason: input.failureReason ?? null,
          ipHash: this.hashIp(input.ipAddress),
          userAgent: input.userAgent?.slice(0, 512) ?? null,
          requestId: input.requestId?.slice(0, 128) ?? null,
        }),
      );
    } catch (error) {
      // Auditing must not turn a valid authentication request into a failure.
      this.logger.error('Failed to persist auth audit log', error);
    }
  }

  private hashIp(ipAddress?: string): string | null {
    const secret = process.env.AUTH_AUDIT_IP_HASH_SECRET;
    if (!ipAddress || !secret) return null;

    return createHash('sha256').update(`${secret}:${ipAddress}`).digest('hex');
  }
}
