import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CrawlerModule } from './modules/crawler/crawler.module';
import { AiProcessorModule } from './modules/ai-processor/ai-processor.module';
import { EpisodesModule } from './modules/episodes/episodes.module';
import { TtsModule } from './modules/tts/tts.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CardNewsModule } from './modules/card-news/card-news.module';
import { CardNews } from './modules/card-news/entities/card-news.entity';
import { PodcastEpisode } from './modules/episodes/entities/podcast-episode.entity';
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
      entities: [PodcastEpisode, User, RefreshToken, CardNews],
      synchronize: (process.env.DB_SYNC ?? 'true') === 'true',
    }),
    CrawlerModule,
    AiProcessorModule,
    EpisodesModule,
    TtsModule,
    AuthModule,
    UsersModule,
    CardNewsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
