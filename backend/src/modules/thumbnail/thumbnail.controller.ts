import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ThumbnailService } from './thumbnail.service';

@Controller('thumbnail')
@UseGuards(JwtAuthGuard)
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
