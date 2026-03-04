import { Controller, Get, Param, Post } from '@nestjs/common';
import { CardNewsService } from './card-news.service';

@Controller('card-news')
export class CardNewsController {
  constructor(private readonly cardNewsService: CardNewsService) {}

  /** 테스트용: 실제 대본 기반, 1장만 생성 (Gemini 2번) */
  @Post('test/:episodeId')
  test(@Param('episodeId') episodeId: string) {
    return this.cardNewsService.testGenerate(episodeId);
  }

  @Post('generate/:episodeId')
  generate(@Param('episodeId') episodeId: string) {
    return this.cardNewsService.generate(episodeId);
  }

  @Get(':episodeId')
  findByEpisodeId(@Param('episodeId') episodeId: string) {
    return this.cardNewsService.findByEpisodeId(episodeId);
  }
}
