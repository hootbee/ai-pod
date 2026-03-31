import { Module } from '@nestjs/common';
import { AudioOptimizationService } from './audio-optimization.service';
import { AudioStreamService } from './audio-stream.service';

@Module({
  providers: [AudioOptimizationService, AudioStreamService],
  exports: [AudioOptimizationService, AudioStreamService],
})
export class AudioModule {}
