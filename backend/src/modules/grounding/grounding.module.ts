import { Module } from '@nestjs/common';
import { GroundingService } from './grounding.service';

@Module({
  providers: [GroundingService],
  exports: [GroundingService],
})
export class GroundingModule {}
