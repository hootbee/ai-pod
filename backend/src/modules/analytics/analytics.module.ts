import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsEventController } from './analytics-event.controller';
import { AnalyticsEventService } from './analytics-event.service';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEvent } from './entities/analytics-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsEvent])],
  controllers: [AnalyticsController, AnalyticsEventController],
  providers: [AnalyticsEventService, AnalyticsService],
  exports: [AnalyticsEventService],
})
export class AnalyticsModule {}
