import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountDeletionAuditEvents1762000000000 implements MigrationInterface {
  name = 'AddAccountDeletionAuditEvents1762000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public"."auth_audit_logs_eventtype_enum"
      ADD VALUE IF NOT EXISTS 'account_deletion_requested'
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."auth_audit_logs_eventtype_enum"
      ADD VALUE IF NOT EXISTS 'account_deletion_succeeded'
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."auth_audit_logs_eventtype_enum"
      ADD VALUE IF NOT EXISTS 'account_deletion_failed'
    `);
  }

  async down(): Promise<void> {
    // PostgreSQL does not support removing enum values safely in-place.
  }
}
