import { InjectQueue } from '@nestjs/bull';
import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import type { Queue } from 'bull';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { TTS_JOB, TTS_QUEUE } from '../../common/queues/tts.constants';

@Controller('tts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class TtsController {
  constructor(@InjectQueue(TTS_QUEUE) private readonly ttsQueue: Queue) {}

  /**
   * 에피소드 ID로 TTS 변환 시작 (비동기 큐)
   * 1단계: POST /pipeline/briefing/run 으로 에피소드 생성
   * 2단계: POST /tts/generate/:episodeId 로 TTS 시작
   */
  @Post('generate/:episodeId')
  async generateAudio(@Param('episodeId') episodeId: string) {
    const job = await this.ttsQueue.add(TTS_JOB.GENERATE, { episodeId });
    return { jobId: job.id, episodeId, status: 'queued', message: 'TTS 변환 시작됨. /tts/status/:jobId 로 상태 확인' };
  }

  /** 짧은 텍스트로 TTS 테스트 (비동기 큐) */
  @Post('test')
  async test(@Body('text') text?: string) {
    const job = await this.ttsQueue.add(TTS_JOB.TEST, { text });
    return { jobId: job.id, status: 'queued', message: '백그라운드에서 TTS 생성 중...' };
  }

  /** Job 상태 확인 */
  @Get('status/:jobId')
  async getStatus(@Param('jobId') jobId: string) {
    const job = await this.ttsQueue.getJob(jobId);
    if (!job) return { status: 'not_found' };

    const state = await job.getState();
    const progress = job.progress();
    const result = state === 'completed' ? job.returnvalue : null;
    const failReason = state === 'failed' ? job.failedReason : null;

    return { jobId, status: state, progress, result, failReason };
  }
}
