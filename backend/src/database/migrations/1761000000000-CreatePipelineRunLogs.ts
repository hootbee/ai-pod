import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePipelineRunLogs1761000000000 implements MigrationInterface {
  name = 'CreatePipelineRunLogs1761000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pipeline_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "runType" varchar(16) NOT NULL,
        "businessDate" date NOT NULL,
        "status" varchar(32) NOT NULL,
        "currentStep" varchar(64),
        "episodeId" uuid,
        "warnings" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "errorMessage" text,
        "startedAt" timestamptz NOT NULL,
        "completedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pipeline_runs_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pipeline_run_steps" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "pipelineRunId" uuid NOT NULL,
        "step" varchar(64) NOT NULL,
        "status" varchar(16) NOT NULL,
        "errorMessage" text,
        "metadata" jsonb,
        "startedAt" timestamptz NOT NULL,
        "completedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pipeline_run_steps_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pipeline_run_steps_run" FOREIGN KEY ("pipelineRunId") REFERENCES "pipeline_runs"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_pipeline_runs_date_type" ON "pipeline_runs" ("businessDate", "runType")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_pipeline_runs_status_started" ON "pipeline_runs" ("status", "startedAt")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_pipeline_run_steps_run_created" ON "pipeline_run_steps" ("pipelineRunId", "createdAt")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_pipeline_run_steps_step_status" ON "pipeline_run_steps" ("step", "status", "createdAt")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "pipeline_run_steps"');
    await queryRunner.query('DROP TABLE IF EXISTS "pipeline_runs"');
  }
}
