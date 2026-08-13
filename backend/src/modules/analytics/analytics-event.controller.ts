import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { TokenPayload } from '../auth/interfaces/token.service.interface';
import { AnalyticsEventService } from './analytics-event.service';
import { CreateAnalyticsEventDto } from './dto/create-analytics-event.dto';

@Controller('analytics')
export class AnalyticsEventController {
  constructor(private readonly eventService: AnalyticsEventService) {}

  @Post('events')
  @UseGuards(JwtAuthGuard)
  async recordEvent(@CurrentUser() user: TokenPayload, @Body() dto: CreateAnalyticsEventDto) {
    if (!AnalyticsEventService.clientEventTypes.has(dto.eventType)) {
      throw new BadRequestException('This event type is recorded by the server');
    }
    const event = await this.eventService.record(user.sub, dto);
    return { id: event.id, eventType: event.eventType, createdAt: event.createdAt };
  }
}
