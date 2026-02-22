import { Module } from '@nestjs/common';
import { EpisodesModule } from '../episodes/episodes.module';
import { TtsService } from './tts.service';

@Module({
  imports: [EpisodesModule],
  providers: [TtsService],
  exports: [TtsService],
})
export class TtsModule {}
