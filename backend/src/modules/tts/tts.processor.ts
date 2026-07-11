import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { TtsService } from './tts.service';
import { TTS_JOB, TTS_QUEUE } from './tts.constants';

export interface TtsGenerateJobData {
  episodeId: string;
}

export interface TtsTestJobData {
  text?: string;
  outputPath: string;
}

@Processor(TTS_QUEUE)
export class TtsProcessor {
  private readonly logger = new Logger(TtsProcessor.name);

  constructor(private readonly ttsService: TtsService) {}

  @Process(TTS_JOB.GENERATE)
  async handleGenerate(job: Job<TtsGenerateJobData>) {
    this.logger.log(`[JOB] TTS 생성 시작: episodeId=${job.data.episodeId}`);
    try {
      await job.progress(0);
      const result = await this.ttsService.generateAudio(job.data.episodeId);
      await job.progress(100);
      this.logger.log(`[JOB] TTS 완료: ${result.audioPath}`);
      return result;
    } catch (error) {
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
