import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PipelineService } from './pipeline.service';
import { PipelineScheduler } from './pipeline.scheduler';
import { PipelineController } from './pipeline.controller';
import { GroundingModule } from '../grounding/grounding.module';
import { AiProcessorModule } from '../ai-processor/ai-processor.module';
import { EpisodesModule } from '../episodes/episodes.module';
import { CardNewsModule } from '../card-news/card-news.module';
import { ThumbnailModule } from '../thumbnail/thumbnail.module';
import { TtsQueueModule } from '../../common/queues/tts-queue.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PipelineRun } from './entities/pipeline-run.entity';
import { PipelineRunStep } from './entities/pipeline-run-step.entity';
import { PipelineRunService } from './pipeline-run.service';
import { PipelineRunController } from './pipeline-run.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TtsQueueModule,
    GroundingModule,
    AiProcessorModule,
    EpisodesModule,
    CardNewsModule,
    ThumbnailModule,
    TypeOrmModule.forFeature([PipelineRun, PipelineRunStep]),
  ],
  controllers: [PipelineController, PipelineRunController],
  providers: [PipelineService, PipelineScheduler, PipelineRunService],
  exports: [PipelineRunService],
})
export class PipelineModule {}
