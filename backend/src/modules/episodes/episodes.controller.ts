import { InjectQueue } from '@nestjs/bull';
import { Body, Controller, Get, Head, Param, Patch, Post, Req, Res } from '@nestjs/common';
import type { Queue } from 'bull';
import * as fs from 'fs';
import * as path from 'path';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateAudioPathDto } from './dto/update-audio-path.dto';
import { EpisodesService } from './episodes.service';
import { HeadlineService } from './headline.service';
import { TTS_JOB, TTS_QUEUE } from '../tts/tts.constants';
import type { Request, Response } from 'express';

@Controller('episodes')
export class EpisodesController {
  constructor(
    private readonly episodesService: EpisodesService,
    private readonly headlineService: HeadlineService,
    @InjectQueue(TTS_QUEUE) private readonly ttsQueue: Queue,
  ) {}

  @Post()
  create(@Body() createEpisodeDto: CreateEpisodeDto) {
    return this.episodesService.create(createEpisodeDto);
  }

  @Get()
  findAll() {
    return this.episodesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.episodesService.findOne(id);
  }

  @Patch(':id/audio-path')
  updateAudioPath(@Param('id') id: string, @Body() updateAudioPathDto: UpdateAudioPathDto) {
    return this.episodesService.updateAudioPath(id, updateAudioPathDto);
  }

  /** 오디오 스트리밍 HEAD (확장자 힌트 URL 포함) */
  @Head(':id/audio/stream')
  async streamAudioHead(@Param('id') id: string, @Res() res: Response) {
    const { fileSize, contentType, contentDisposition } = await this.resolveStreamMeta(id);
    this.applyBaseHeaders(res, contentType, contentDisposition);
    res.setHeader('Content-Length', fileSize.toString());
    res.status(200).end();
  }

  /** 오디오 스트리밍 HEAD (예: /audio/stream.mp3) */
  @Head(':id/audio/stream.:extHint')
  async streamAudioHeadWithExt(
    @Param('id') id: string,
    @Param('extHint') extHint: string,
    @Res() res: Response,
  ) {
    const { fileSize, contentType, contentDisposition } = await this.resolveStreamMeta(id, extHint);
    this.applyBaseHeaders(res, contentType, contentDisposition);
    res.setHeader('Content-Length', fileSize.toString());
    res.status(200).end();
  }

  /** 오디오 스트리밍 (HTTP Range 지원) */
  @Get(':id/audio/stream')
  async streamAudio(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    return this.streamAudioInternal(id, req, res);
  }

  /** 오디오 스트리밍 (예: /audio/stream.mp3) */
  @Get(':id/audio/stream.:extHint')
  async streamAudioWithExt(
    @Param('id') id: string,
    @Param('extHint') extHint: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.streamAudioInternal(id, req, res, extHint);
  }

  private async streamAudioInternal(id: string, req: Request, res: Response, extHint?: string) {
    const { filePath, fileSize, contentType, contentDisposition } = await this.resolveStreamMeta(id, extHint);
    this.applyBaseHeaders(res, contentType, contentDisposition);

    const range = req.headers.range;
    if (!range) {
      res.status(200);
      res.setHeader('Content-Length', fileSize.toString());
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    const matches = /bytes=(\d*)-(\d*)/.exec(range);
    const start = matches?.[1] ? Number(matches[1]) : 0;
    const end = matches?.[2] ? Number(matches[2]) : fileSize - 1;
    const safeStart = Number.isFinite(start) ? start : 0;
    const safeEnd = Number.isFinite(end) ? Math.min(end, fileSize - 1) : fileSize - 1;

    if (safeStart > safeEnd || safeStart < 0) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    const chunkSize = safeEnd - safeStart + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${safeStart}-${safeEnd}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize.toString());
    fs.createReadStream(filePath, { start: safeStart, end: safeEnd }).pipe(res);
  }

  private async resolveStreamMeta(id: string, extHint?: string) {
    const filePath = await this.episodesService.resolveAudioFilePath(id, extHint);
    const fileSize = fs.statSync(filePath).size;
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.wav'
      ? 'audio/wav'
      : ext === '.m4a'
        ? 'audio/mp4'
        : ext === '.aac'
          ? 'audio/aac'
          : 'audio/mpeg';
    const contentDisposition = `inline; filename*=UTF-8''${encodeURIComponent(path.basename(filePath))}`;
    return { filePath, fileSize, contentType, contentDisposition };
  }

  private applyBaseHeaders(res: Response, contentType: string, contentDisposition: string) {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Disposition', contentDisposition);
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
