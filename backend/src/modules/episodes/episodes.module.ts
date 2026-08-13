import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EpisodesController } from './episodes.controller';
import { EpisodesService } from './episodes.service';
import { HeadlineService } from './headline.service';
import { AudioModule } from '../audio/audio.module';
import { PodcastEpisode } from './entities/podcast-episode.entity';
import { EpisodePlayLog } from './entities/episode-play-log.entity';
import { EpisodeThumbnail } from './entities/episode-thumbnail.entity';
import { AnalyticsModule } from '../analytics/analytics.module';
import { TtsQueueModule } from '../../common/queues/tts-queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PodcastEpisode, EpisodeThumbnail, EpisodePlayLog]),
    TtsQueueModule,
    AudioModule,
    AnalyticsModule,
  ],
  controllers: [EpisodesController],
  providers: [EpisodesService, HeadlineService],
  exports: [EpisodesService, HeadlineService],
})
export class EpisodesModule {}
