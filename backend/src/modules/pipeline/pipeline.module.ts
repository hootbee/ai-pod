import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { PipelineService } from './pipeline.service';
import { PipelineScheduler } from './pipeline.scheduler';
import { PipelineController } from './pipeline.controller';
import { GroundingModule } from '../grounding/grounding.module';
import { AiProcessorModule } from '../ai-processor/ai-processor.module';
import { EpisodesModule } from '../episodes/episodes.module';
import { CardNewsModule } from '../card-news/card-news.module';
import { ThumbnailModule } from '../thumbnail/thumbnail.module';
import { TTS_QUEUE } from '../tts/tts.constants';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.registerQueue({ name: TTS_QUEUE }),
    GroundingModule,
    AiProcessorModule,
    EpisodesModule,
    CardNewsModule,
    ThumbnailModule,
  ],
  controllers: [PipelineController],
  providers: [PipelineService, PipelineScheduler],
})
export class PipelineModule {}
