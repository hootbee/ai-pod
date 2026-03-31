import { InjectQueue } from '@nestjs/bull';
import { Body, Controller, Get, Head, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Queue } from 'bull';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { PaginateEpisodesDto } from './dto/paginate-episodes.dto';
import { UpdateAudioPathDto } from './dto/update-audio-path.dto';
import { EpisodesService } from './episodes.service';
import { HeadlineService } from './headline.service';
import { AudioStreamService } from '../audio/audio-stream.service';
import { TTS_JOB, TTS_QUEUE } from '../tts/tts.constants';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { TokenPayload } from '../auth/interfaces/token.service.interface';

@Controller('episodes')
export class EpisodesController {
  constructor(
    private readonly episodesService: EpisodesService,
    private readonly headlineService: HeadlineService,
    private readonly audioStreamService: AudioStreamService,
    @InjectQueue(TTS_QUEUE) private readonly ttsQueue: Queue,
  ) {}

  @Post()
  create(@Body() createEpisodeDto: CreateEpisodeDto) {
    return this.episodesService.create(createEpisodeDto);
  }

  @Get()
  findAll(@Query() paginateDto: PaginateEpisodesDto) {
    return this.episodesService.findAll(paginateDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.episodesService.findOne(id);
  }

  @Patch(':id/audio-path')
  updateAudioPath(@Param('id') id: string, @Body() updateAudioPathDto: UpdateAudioPathDto) {
    return this.episodesService.updateAudioPath(id, updateAudioPathDto);
  }

  @Get(':id/audio-play-count')
  getAudioPlayCount(@Param('id') id: string) {
    return this.episodesService.getAudioPlayCount(id);
  }

  @Post(':id/audio-play-count')
  @UseGuards(JwtAuthGuard)
  incrementAudioPlayCount(
    @Param('id') id: string,
    @CurrentUser() user: TokenPayload,
  ) {
    return this.episodesService.incrementAudioPlayCount(id, user.sub);
  }

  /** 오디오 스트리밍 HEAD */
  @Head(':id/audio/stream')
  @UseGuards(JwtAuthGuard)
  async streamAudioHead(@Param('id') id: string, @Res() res: Response) {
    const filePath = await this.episodesService.resolveAudioFilePath(id);
    this.audioStreamService.streamHead(filePath, res);
  }

  /** 오디오 스트리밍 HEAD (예: /audio/stream.mp3) */
  @Head(':id/audio/stream.:extHint')
  @UseGuards(JwtAuthGuard)
  async streamAudioHeadWithExt(
    @Param('id') id: string,
    @Param('extHint') extHint: string,
    @Res() res: Response,
  ) {
    const filePath = await this.episodesService.resolveAudioFilePath(id, extHint);
    this.audioStreamService.streamHead(filePath, res);
  }

  /** 오디오 스트리밍 (HTTP Range 지원) */
  @Get(':id/audio/stream')
  @UseGuards(JwtAuthGuard)
  async streamAudio(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const filePath = await this.episodesService.resolveAudioFilePath(id);
    this.audioStreamService.stream(filePath, req, res);
  }

  /** 오디오 스트리밍 (예: /audio/stream.mp3) */
  @Get(':id/audio/stream.:extHint')
  @UseGuards(JwtAuthGuard)
  async streamAudioWithExt(
    @Param('id') id: string,
    @Param('extHint') extHint: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const filePath = await this.episodesService.resolveAudioFilePath(id, extHint);
    this.audioStreamService.stream(filePath, req, res);
  }

  /** TTS 생성 — Bull Queue 비동기 처리 */
  @Post(':id/generate-audio')
  async generateAudio(@Param('id') id: string) {
    const job = await this.ttsQueue.add(TTS_JOB.GENERATE, { episodeId: id });
    return { jobId: job.id, status: 'queued', message: 'TTS 생성이 백그라운드에서 시작됐습니다.' };
  }

  /** 클릭베이트 헤드라인 + 부제 생성 */
  @Post(':id/generate-headline')
  generateHeadline(@Param('id') id: string) {
    return this.headlineService.generateAndSave(id);
  }
}
