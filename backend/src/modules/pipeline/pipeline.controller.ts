import { Body, Controller, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('pipeline')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
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

  /**
   * DB/캐시/생성 파일 초기화 후 전체 파이프라인 실행
   * 기본값으로 force=true 적용 (초기화 직후 강제 실행)
   */
  @Post('reset-and-run')
  resetAndRun(@Query('force') force?: string) {
    return this.pipelineService.resetAndRun(force !== 'false');
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
