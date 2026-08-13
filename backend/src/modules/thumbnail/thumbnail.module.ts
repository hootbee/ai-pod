import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EpisodeThumbnail } from '../episodes/entities/episode-thumbnail.entity';
import { ThumbnailController } from './thumbnail.controller';
import { ThumbnailService } from './thumbnail.service';
import { ThumbnailPromptService } from './thumbnail-prompt.service';
import { ThumbnailGeneratorService } from './thumbnail-generator.service';
import { PodcastEpisode } from '../episodes/entities/podcast-episode.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EpisodeThumbnail, PodcastEpisode])],
  controllers: [ThumbnailController],
  providers: [ThumbnailService, ThumbnailPromptService, ThumbnailGeneratorService],
  exports: [ThumbnailService],
})
export class ThumbnailModule {}
