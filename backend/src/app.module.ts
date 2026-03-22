import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CrawlerModule } from './modules/crawler/crawler.module';
import { AiProcessorModule } from './modules/ai-processor/ai-processor.module';
import { EpisodesModule } from './modules/episodes/episodes.module';
import { TtsModule } from './modules/tts/tts.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CardNewsModule } from './modules/card-news/card-news.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { ThumbnailModule } from './modules/thumbnail/thumbnail.module';
import { CardNews } from './modules/card-news/entities/card-news.entity';
import { CardNewsViewLog } from './modules/card-news/entities/card-news-view-log.entity';
import { PodcastEpisode } from './modules/episodes/entities/podcast-episode.entity';
import { EpisodePlayLog } from './modules/episodes/entities/episode-play-log.entity';
import { EpisodeThumbnail } from './modules/thumbnail/entities/episode-thumbnail.entity';
import { User } from './modules/users/entities/user.entity';
import { RefreshToken } from './modules/auth/entities/refresh-token.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    BullModule.forRoot({
      redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'myuser',
      password: process.env.DB_PASSWORD ?? 'mypassword',
      database: process.env.DB_NAME ?? 'aipod_db',
      entities: [PodcastEpisode, EpisodePlayLog, User, RefreshToken, CardNews, CardNewsViewLog, EpisodeThumbnail],
      synchronize: (process.env.DB_SYNC ?? 'true') === 'true',
    }),
    CrawlerModule,
    AiProcessorModule,
    EpisodesModule,
    TtsModule,
    AuthModule,
    UsersModule,
    CardNewsModule,
    PipelineModule,
    ThumbnailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
