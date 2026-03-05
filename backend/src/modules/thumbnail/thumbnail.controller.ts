import { Controller, Get, Param, Post } from '@nestjs/common';
import { ThumbnailService } from './thumbnail.service';

@Controller('thumbnail')
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
