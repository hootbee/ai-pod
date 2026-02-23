import { Controller, Get, Param, Post } from '@nestjs/common';
import { CardNewsService } from './card-news.service';

@Controller('card-news')
export class CardNewsController {
  constructor(private readonly cardNewsService: CardNewsService) {}

  @Post('generate/:episodeId')
  generate(@Param('episodeId') episodeId: string) {
    return this.cardNewsService.generate(episodeId);
  }

  @Get(':episodeId')
  findByEpisodeId(@Param('episodeId') episodeId: string) {
    return this.cardNewsService.findByEpisodeId(episodeId);
  }
}
