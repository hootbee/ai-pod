import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ThumbnailService } from './thumbnail.service';

@Controller('thumbnail')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ThumbnailController {
  constructor(private readonly thumbnailService: ThumbnailService) {}

  /** 썸네일 생성 (없으면 생성, 있으면 재생성) */
  @Post(':episodeId')
  generate(@Param('episodeId') episodeId: string) {
    return this.thumbnailService.generateAndSave(episodeId);
  }

  /** 썸네일 조회 */
  @Get(':episodeId')
  findOne(@Param('episodeId') episodeId: string) {
    return this.thumbnailService.findByEpisodeId(episodeId);
  }
}
