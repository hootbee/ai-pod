import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EpisodesController } from './episodes.controller';
import { EpisodesService } from './episodes.service';
import { PodcastEpisode } from './entities/podcast-episode.entity';
import { TtsService } from '../tts/tts.service';

@Module({
  imports: [TypeOrmModule.forFeature([PodcastEpisode])],
  controllers: [EpisodesController],
  providers: [EpisodesService, TtsService],
  exports: [EpisodesService],
})
export class EpisodesModule {}
