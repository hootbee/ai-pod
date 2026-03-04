import { Body, Controller, Param, Post, Query } from '@nestjs/common';
import { PipelineService } from './pipeline.service';

@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  /**
   * 전체 파이프라인 즉시 실행
   * ?force=true → 오늘 에피소드가 있어도 강제 재실행
   */
  @Post('run')
  run(@Query('force') force?: string) {
    return this.pipelineService.runDailyPipeline(force === 'true');
  }

  /** 카드뉴스만 재생성 (부분 실패 복구) */
  @Post('retry-cardnews/:episodeId')
  retryCardNews(@Param('episodeId') episodeId: string) {
    return this.pipelineService.retryCardNews(episodeId);
  }

  /** TTS만 재트리거 (부분 실패 복구) */
  @Post('retry-tts/:episodeId')
  retryTts(@Param('episodeId') episodeId: string) {
    return this.pipelineService.retryTts(episodeId);
  }
}
