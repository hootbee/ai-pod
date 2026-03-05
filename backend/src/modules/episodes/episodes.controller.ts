import { InjectQueue } from '@nestjs/bull';
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import type { Queue } from 'bull';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateAudioPathDto } from './dto/update-audio-path.dto';
import { EpisodesService } from './episodes.service';
import { HeadlineService } from './headline.service';
import { TTS_JOB, TTS_QUEUE } from '../tts/tts.constants';

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
