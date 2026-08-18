import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { TtsService } from './tts.service';
import { TTS_JOB, TTS_QUEUE } from '../../common/queues/tts.constants';
import { PipelineRunService } from '../pipeline/pipeline-run.service';
import { PipelineRun } from '../pipeline/entities/pipeline-run.entity';

export interface TtsGenerateJobData {
  episodeId: string;
  pipelineRunId?: string;
  requestId?: string;
}

export interface TtsTestJobData {
  text?: string;
  outputPath: string;
}

@Processor(TTS_QUEUE)
export class TtsProcessor {
  private readonly logger = new Logger(TtsProcessor.name);

  constructor(
    private readonly ttsService: TtsService,
    private readonly pipelineRunService: PipelineRunService,
  ) {}

  @Process(TTS_JOB.GENERATE)
  async handleGenerate(job: Job<TtsGenerateJobData>) {
    this.logger.log(`[JOB] TTS 생성 시작: episodeId=${job.data.episodeId}`);
    try {
      const run = job.data.pipelineRunId ? ({ id: job.data.pipelineRunId } as PipelineRun) : null;
      if (run) await this.pipelineRunService.startStep(run, 'tts_completion', { jobId: job.id });
      await job.progress(0);
      const result = await this.ttsService.generateAudio(job.data.episodeId);
      await job.progress(100);
      if (run)
        await this.pipelineRunService.completeStep(run, 'tts_completion', {
          audioPath: result.audioPath,
          jobId: job.id,
        });
      this.logger.log(`[JOB] TTS 완료: ${result.audioPath}`);
      return result;
    } catch (error) {
      if (job.data.pipelineRunId) {
        await this.pipelineRunService.failStep(
          { id: job.data.pipelineRunId } as PipelineRun,
          'tts_completion',
          error,
          { jobId: job.id },
        );
        await this.pipelineRunService.recordAsyncFailure(
          job.data.pipelineRunId,
          `TTS 생성 실패: ${(error as Error).message}`,
          error,
        );
      }
      this.logger.error(`[JOB] TTS 실패: ${(error as Error).message}`);
      throw error;
    }
  }

  @Process(TTS_JOB.TEST)
  async handleTest(job: Job<TtsTestJobData>) {
    this.logger.log('[JOB] TTS 테스트 시작');
    try {
      const result = await this.ttsService.testGenerate(job.data.text);
      this.logger.log(`[JOB] TTS 테스트 완료: ${result}`);
      return { audioPath: result };
    } catch (error) {
      this.logger.error(`[JOB] TTS 테스트 실패: ${(error as Error).message}`);
      throw error;
    }
  }
}
