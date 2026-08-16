import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnalyticsEvents1760000000000 implements MigrationInterface {
  name = 'CreateAnalyticsEvents1760000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public"."auth_audit_logs_eventtype_enum"
      ADD VALUE IF NOT EXISTS 'signup_success'
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "analytics_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "eventType" varchar(40) NOT NULL,
        "episodeId" uuid,
        "cardNewsId" uuid,
        "sessionId" varchar(128),
        "metadata" jsonb,
        "completedAt" timestamptz,
        "source" varchar(32),
        "sourceEpisodeId" uuid,
        "destinationCardNewsId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_analytics_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_analytics_events_user_created" ON "analytics_events" ("userId", "createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_analytics_events_type_created" ON "analytics_events" ("eventType", "createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_analytics_events_episode_type" ON "analytics_events" ("episodeId", "eventType")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_analytics_events_card_type" ON "analytics_events" ("cardNewsId", "eventType")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "analytics_events"');
  }
}
