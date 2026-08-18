import { Controller, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import type { RequestWithContext } from '../../common/request-context';
import { PipelineTriggerType } from './entities/pipeline-run.entity';

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
  @AuditAction('pipeline.run')
  run(@Query('force') force: string | undefined, @Req() request: RequestWithContext) {
    return this.pipelineService.runDailyPipeline(force === 'true', {
      requestId: request.requestId,
      triggerType: PipelineTriggerType.HTTP,
    });
  }

  /**
   * DB/캐시/생성 파일 초기화 후 전체 파이프라인 실행
   * 기본값으로 force=true 적용 (초기화 직후 강제 실행)
   */
  @Post('reset-and-run')
  @AuditAction('pipeline.reset_and_run')
  resetAndRun(@Query('force') force: string | undefined, @Req() request: RequestWithContext) {
    return this.pipelineService.resetAndRun(force !== 'false', {
      requestId: request.requestId,
      triggerType: PipelineTriggerType.HTTP,
    });
  }

  /** 카드뉴스만 재생성 (부분 실패 복구) */
  @Post('retry-cardnews/:episodeId')
  @AuditAction('pipeline.retry_cardnews')
  retryCardNews(@Param('episodeId') episodeId: string) {
    return this.pipelineService.retryCardNews(episodeId);
  }

  /** TTS만 재트리거 (부분 실패 복구) */
  @Post('retry-tts/:episodeId')
  @AuditAction('pipeline.retry_tts')
  retryTts(@Param('episodeId') episodeId: string, @Req() request: RequestWithContext) {
    return this.pipelineService.retryTts(episodeId, request.requestId);
  }
}
