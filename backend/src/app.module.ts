import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CrawlerModule } from './modules/crawler/crawler.module';
import { AiProcessorModule } from './modules/ai-processor/ai-processor.module';
import { EpisodesModule } from './modules/episodes/episodes.module';
import { PodcastEpisode } from './modules/episodes/entities/podcast-episode.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'myuser',
      password: process.env.DB_PASSWORD ?? 'mypassword',
      database: process.env.DB_NAME ?? 'aipod_db',
      entities: [PodcastEpisode],
      synchronize: (process.env.DB_SYNC ?? 'true') === 'true',
    }),
    CrawlerModule,
    AiProcessorModule,
    EpisodesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
