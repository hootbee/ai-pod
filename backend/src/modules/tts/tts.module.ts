import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { EpisodesModule } from '../episodes/episodes.module';
import { AudioModule } from '../audio/audio.module';
import { TtsService } from './tts.service';
import { TtsController } from './tts.controller';
import { TtsProcessor } from './tts.processor';
import { TTS_QUEUE } from './tts.constants';

@Module({
  imports: [
    EpisodesModule,
    AudioModule,
    BullModule.registerQueue({ name: TTS_QUEUE }),
  ],
  controllers: [TtsController],
  providers: [TtsService, TtsProcessor],
  exports: [TtsService],
})
export class TtsModule {}
