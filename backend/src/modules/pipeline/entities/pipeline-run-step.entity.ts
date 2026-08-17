import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum PipelineRunStepStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity({ name: 'pipeline_run_steps' })
@Index(['pipelineRunId', 'createdAt'])
@Index(['step', 'status', 'createdAt'])
export class PipelineRunStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  pipelineRunId: string;

  @Column({ type: 'varchar', length: 64 })
  step: string;

  @Column({ type: 'varchar', length: 16 })
  status: PipelineRunStepStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
