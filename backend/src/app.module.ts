import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { EpisodeThumbnail } from './modules/episodes/entities/episode-thumbnail.entity';
import { User } from './modules/users/entities/user.entity';
import { RefreshToken } from './modules/auth/entities/refresh-token.entity';
import { AuthAuditLog } from './modules/auth/entities/auth-audit-log.entity';
import { AppVersionModule } from './modules/app-version/app-version.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AnalyticsEvent } from './modules/analytics/entities/analytics-event.entity';
import { PipelineRun } from './modules/pipeline/entities/pipeline-run.entity';
import { PipelineRunStep } from './modules/pipeline/entities/pipeline-run-step.entity';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_TTL', 60000),
          limit: config.get<number>('THROTTLE_LIMIT', 100),
        },
      ],
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
      entities: [
        PodcastEpisode,
        EpisodePlayLog,
        User,
        RefreshToken,
        AuthAuditLog,
        AnalyticsEvent,
        CardNews,
        CardNewsViewLog,
        EpisodeThumbnail,
        PipelineRun,
        PipelineRunStep,
      ],
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
    AppVersionModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
