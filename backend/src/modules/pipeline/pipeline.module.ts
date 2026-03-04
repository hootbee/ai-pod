import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { PipelineService } from './pipeline.service';
import { PipelineScheduler } from './pipeline.scheduler';
import { PipelineController } from './pipeline.controller';
import { CrawlerModule } from '../crawler/crawler.module';
import { AiProcessorModule } from '../ai-processor/ai-processor.module';
import { EpisodesModule } from '../episodes/episodes.module';
import { CardNewsModule } from '../card-news/card-news.module';
import { TTS_QUEUE } from '../tts/tts.constants';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.registerQueue({ name: TTS_QUEUE }),
    CrawlerModule,
    AiProcessorModule,
    EpisodesModule,
    CardNewsModule,
  ],
  controllers: [PipelineController],
  providers: [PipelineService, PipelineScheduler],
})
export class PipelineModule {}
