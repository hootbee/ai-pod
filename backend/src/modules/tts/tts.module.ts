import { Module } from '@nestjs/common';
import { EpisodesModule } from '../episodes/episodes.module';
import { AudioModule } from '../audio/audio.module';
import { TtsService } from './tts.service';
import { TtsController } from './tts.controller';
import { TtsProcessor } from './tts.processor';
import { TtsQueueModule } from '../../common/queues/tts-queue.module';

@Module({
  imports: [
    EpisodesModule,
    AudioModule,
    TtsQueueModule,
  ],
  controllers: [TtsController],
  providers: [TtsService, TtsProcessor],
  exports: [TtsService],
})
export class TtsModule {}
