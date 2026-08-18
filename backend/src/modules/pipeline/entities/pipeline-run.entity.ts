import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PipelineRunType {
  DAILY = 'daily',
  MANUAL = 'manual',
  RETRY = 'retry',
}

export enum PipelineRunStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  COMPLETED_WITH_WARNINGS = 'completed_with_warnings',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export enum PipelineTriggerType {
  HTTP = 'http',
  SCHEDULER = 'scheduler',
  RETRY = 'retry',
}

@Entity({ name: 'pipeline_runs' })
@Index(['businessDate', 'runType'])
@Index(['status', 'startedAt'])
@Index(['requestId', 'startedAt'])
export class PipelineRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  runType: PipelineRunType;

  @Column({ type: 'date' })
  businessDate: string;

  @Column({ type: 'varchar', length: 32 })
  status: PipelineRunStatus;

  @Column({ type: 'varchar', length: 64, nullable: true })
  currentStep: string | null;

  @Column({ type: 'uuid', nullable: true })
  episodeId: string | null;

  @Column({ type: 'varchar', length: 16, default: PipelineTriggerType.SCHEDULER })
  triggerType: PipelineTriggerType;

  @Column({ type: 'varchar', length: 128, nullable: true })
  requestId: string | null;

  @Column({ type: 'jsonb', default: [] })
  warnings: string[];

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
