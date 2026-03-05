import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EpisodesController } from './episodes.controller';
import { EpisodesService } from './episodes.service';
import { HeadlineService } from './headline.service';
import { PodcastEpisode } from './entities/podcast-episode.entity';
import { TTS_QUEUE } from '../tts/tts.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([PodcastEpisode]),
    BullModule.registerQueue({ name: TTS_QUEUE }),
  ],
  controllers: [EpisodesController],
  providers: [EpisodesService, HeadlineService],
  exports: [EpisodesService, HeadlineService],
})
export class EpisodesModule {}
