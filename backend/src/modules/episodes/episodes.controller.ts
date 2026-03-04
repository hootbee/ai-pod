import { InjectQueue } from '@nestjs/bull';
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import type { Queue } from 'bull';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateAudioPathDto } from './dto/update-audio-path.dto';
import { EpisodesService } from './episodes.service';
import { TTS_JOB, TTS_QUEUE } from '../tts/tts.constants';

@Controller('episodes')
export class EpisodesController {
  constructor(
    private readonly episodesService: EpisodesService,
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
}
