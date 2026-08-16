import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum AuthAuditEventType {
  SIGNUP_SUCCESS = 'signup_success',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  REFRESH_SUCCESS = 'refresh_success',
  REFRESH_FAILURE = 'refresh_failure',
  LOGOUT_SUCCESS = 'logout_success',
  LOGOUT_FAILURE = 'logout_failure',
}

@Entity({ name: 'auth_audit_logs' })
export class AuthAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({
    type: 'enum',
    enum: AuthAuditEventType,
  })
  eventType: AuthAuditEventType;

  @Column({ type: 'varchar', length: 32, nullable: true })
  provider: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  failureReason: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  ipHash: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  requestId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  occurredAt: Date;
}
