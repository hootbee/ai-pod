import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { TokenPayload } from '../auth/interfaces/token.service.interface';
import { EpisodesService } from '../episodes/episodes.service';
import { PaginateEpisodesDto } from '../episodes/dto/paginate-episodes.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly episodesService: EpisodesService) {}

  @Get('me/history')
  @UseGuards(JwtAuthGuard)
  getListeningHistory(
    @CurrentUser() user: TokenPayload,
    @Query() dto: PaginateEpisodesDto,
  ) {
    return this.episodesService.getListeningHistory(user.sub, dto.limit ?? 10, dto.offset ?? 0);
  }
}
