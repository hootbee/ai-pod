import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TTS_QUEUE } from './tts.constants';

@Module({
  imports: [BullModule.registerQueue({ name: TTS_QUEUE })],
  exports: [BullModule],
})
export class TtsQueueModule {}
