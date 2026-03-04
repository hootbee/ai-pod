import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PipelineService } from './pipeline.service';

@Injectable()
export class PipelineScheduler {
  private readonly logger = new Logger(PipelineScheduler.name);
  private isRunning = false;

  constructor(private readonly pipelineService: PipelineService) {}

  /**
   * 매일 KST 04:00에 전체 파이프라인 자동 실행
   * 이전 실행이 완료되지 않았으면 skip (isRunning 플래그)
   */
  @Cron('0 4 * * *', { timeZone: 'Asia/Seoul' })
  async handleDailyPipeline() {
    if (this.isRunning) {
      this.logger.warn('[Scheduler] 이전 파이프라인 아직 실행 중 → skip');
      return;
    }

    this.isRunning = true;
    this.logger.log('[Scheduler] 일일 파이프라인 시작 (KST 04:00)');

    try {
      const result = await this.pipelineService.runDailyPipeline();
      if (result.skipped) {
        this.logger.log(`[Scheduler] 파이프라인 skip: ${result.reason}`);
      } else {
        this.logger.log(`[Scheduler] 파이프라인 완료: episodeId=${result.episodeId}, warnings=${result.warnings.length}건`);
      }
    } catch (err) {
      this.logger.error('[Scheduler] 파이프라인 치명적 오류', err instanceof Error ? err.stack : err);
    } finally {
      this.isRunning = false;
    }
  }
}
