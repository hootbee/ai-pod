import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PipelineRun,
  PipelineRunStatus,
  PipelineRunType,
  PipelineTriggerType,
} from './entities/pipeline-run.entity';
import { PipelineRunStep, PipelineRunStepStatus } from './entities/pipeline-run-step.entity';

@Injectable()
export class PipelineRunService {
  constructor(
    @InjectRepository(PipelineRun)
    private readonly runRepository: Repository<PipelineRun>,
    @InjectRepository(PipelineRunStep)
    private readonly stepRepository: Repository<PipelineRunStep>,
  ) {}

  async startRun(
    runType: PipelineRunType,
    businessDate: string,
    episodeId?: string,
    context?: { requestId?: string; triggerType?: PipelineTriggerType },
  ): Promise<PipelineRun> {
    return this.runRepository.save(
      this.runRepository.create({
        runType,
        businessDate,
        status: PipelineRunStatus.RUNNING,
        currentStep: null,
        episodeId: episodeId ?? null,
        triggerType: context?.triggerType ?? PipelineTriggerType.SCHEDULER,
        requestId: context?.requestId?.slice(0, 128) ?? null,
        warnings: [],
        errorMessage: null,
        startedAt: new Date(),
        completedAt: null,
      }),
    );
  }

  async startStep(
    run: PipelineRun,
    step: string,
    metadata?: Record<string, unknown>,
  ): Promise<PipelineRunStep> {
    run.currentStep = step;
    await this.runRepository.save(run);
    return this.stepRepository.save(
      this.stepRepository.create({
        pipelineRunId: run.id,
        step,
        status: PipelineRunStepStatus.RUNNING,
        errorMessage: null,
        metadata: metadata ?? null,
        startedAt: new Date(),
        completedAt: null,
      }),
    );
  }

  async completeStep(
    run: PipelineRun,
    step: string,
    metadata?: Record<string, unknown>,
  ): Promise<PipelineRunStep> {
    return this.stepRepository.save(
      this.stepRepository.create({
        pipelineRunId: run.id,
        step,
        status: PipelineRunStepStatus.COMPLETED,
        errorMessage: null,
        metadata: metadata ?? null,
        startedAt: new Date(),
        completedAt: new Date(),
      }),
    );
  }

  async failStep(
    run: PipelineRun,
    step: string,
    error: unknown,
    metadata?: Record<string, unknown>,
  ): Promise<PipelineRunStep> {
    return this.stepRepository.save(
      this.stepRepository.create({
        pipelineRunId: run.id,
        step,
        status: PipelineRunStepStatus.FAILED,
        errorMessage: this.formatError(error),
        metadata: metadata ?? null,
        startedAt: new Date(),
        completedAt: new Date(),
      }),
    );
  }

  async finishRun(run: PipelineRun, warnings: string[], episodeId?: string): Promise<PipelineRun> {
    run.status =
      warnings.length > 0 ? PipelineRunStatus.COMPLETED_WITH_WARNINGS : PipelineRunStatus.COMPLETED;
    run.currentStep = null;
    run.warnings = warnings;
    run.episodeId = episodeId ?? run.episodeId;
    run.completedAt = new Date();
    return this.runRepository.save(run);
  }

  async failRun(run: PipelineRun, error: unknown, episodeId?: string): Promise<PipelineRun> {
    run.status = PipelineRunStatus.FAILED;
    run.currentStep = null;
    run.errorMessage = this.formatError(error);
    run.episodeId = episodeId ?? run.episodeId;
    run.completedAt = new Date();
    return this.runRepository.save(run);
  }

  async recordAsyncFailure(
    runId: string,
    warning: string,
    error?: unknown,
  ): Promise<PipelineRun | null> {
    const run = await this.runRepository.findOne({ where: { id: runId } });
    if (!run) return null;

    run.status = PipelineRunStatus.COMPLETED_WITH_WARNINGS;
    run.warnings = [...(run.warnings ?? []), warning];
    run.errorMessage = error ? this.formatError(error) : run.errorMessage;
    run.completedAt = run.completedAt ?? new Date();
    return this.runRepository.save(run);
  }

  async skipRun(run: PipelineRun, reason: string, episodeId?: string): Promise<PipelineRun> {
    run.status = PipelineRunStatus.SKIPPED;
    run.currentStep = null;
    run.warnings = [reason];
    run.episodeId = episodeId ?? run.episodeId;
    run.completedAt = new Date();
    return this.runRepository.save(run);
  }

  async listRuns(
    limit = 20,
    offset = 0,
  ): Promise<{ data: PipelineRun[]; total: number; limit: number; offset: number }> {
    const normalizedLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20;
    const normalizedOffset = Number.isFinite(offset) ? Math.max(offset, 0) : 0;
    const [data, total] = await this.runRepository.findAndCount({
      order: { startedAt: 'DESC' },
      take: normalizedLimit,
      skip: normalizedOffset,
    });
    return { data, total, limit: normalizedLimit, offset: normalizedOffset };
  }

  async findRun(id: string): Promise<PipelineRun | null> {
    return this.runRepository.findOne({ where: { id } });
  }

  async findSteps(runId: string): Promise<PipelineRunStep[]> {
    return this.stepRepository.find({
      where: { pipelineRunId: runId },
      order: { createdAt: 'ASC' },
    });
  }

  private formatError(error: unknown): string {
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
}
