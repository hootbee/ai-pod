import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateAudioPathDto } from './dto/update-audio-path.dto';
import { EpisodesService } from './episodes.service';
import { TtsService } from '../tts/tts.service';

@Controller('episodes')
export class EpisodesController {
  constructor(
    private readonly episodesService: EpisodesService,
    private readonly ttsService: TtsService,
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

  @Post(':id/generate-audio')
  generateAudio(@Param('id') id: string) {
    return this.ttsService.generateAudio(id);
  }
}
