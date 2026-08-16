import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsPeriodDto, AnalyticsUsersQueryDto } from './dto/analytics-query.dto';

@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  overview(@Query() query: AnalyticsPeriodDto) {
    return this.analyticsService.overview(query);
  }

  @Get('funnel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  funnel(@Query() query: AnalyticsPeriodDto) {
    return this.analyticsService.funnel(query);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  users(@Query() query: AnalyticsUsersQueryDto) {
    return this.analyticsService.users(query);
  }

  @Get('episodes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  episodes(@Query() query: AnalyticsPeriodDto) {
    return this.analyticsService.episodes(query);
  }

  @Get('card-news')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  cardNews(@Query() query: AnalyticsPeriodDto) {
    return this.analyticsService.cardNews(query);
  }

  @Get('retention')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  retention(@Query() query: AnalyticsPeriodDto) {
    return this.analyticsService.retention(query);
  }

  @Get('auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  auth(@Query() query: AnalyticsPeriodDto) {
    return this.analyticsService.auth(query);
  }
}
