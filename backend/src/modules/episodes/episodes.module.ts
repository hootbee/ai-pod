import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EpisodesController } from './episodes.controller';
import { EpisodesService } from './episodes.service';
import { HeadlineService } from './headline.service';
import { AudioModule } from '../audio/audio.module';
import { PodcastEpisode } from './entities/podcast-episode.entity';
import { EpisodePlayLog } from './entities/episode-play-log.entity';
import { TTS_QUEUE } from '../tts/tts.constants';
import { EpisodeThumbnail } from '../thumbnail/entities/episode-thumbnail.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PodcastEpisode, EpisodeThumbnail, EpisodePlayLog]),
    BullModule.registerQueue({ name: TTS_QUEUE }),
    AudioModule,
  ],
  controllers: [EpisodesController],
  providers: [EpisodesService, HeadlineService],
  exports: [EpisodesService, HeadlineService],
})
export class EpisodesModule {}
