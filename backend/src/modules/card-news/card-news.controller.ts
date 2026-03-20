import { Controller, Get, Param, Post } from '@nestjs/common';
import { CardNewsService } from './card-news.service';

@Controller('card-news')
export class CardNewsController {
  constructor(private readonly cardNewsService: CardNewsService) {}

  /** 테스트: 첫 번째 topic 1장만 생성 (LLM 1회) */
  @Post('test/:episodeId')
  test(@Param('episodeId') episodeId: string) {
    return this.cardNewsService.testGenerate(episodeId);
  }

  /** 전체 슬라이드 생성 (표지 + 모든 topic + 마무리) */
  @Post('generate/:episodeId')
  generate(@Param('episodeId') episodeId: string) {
    return this.cardNewsService.generate(episodeId);
  }

  /**
   * 첫 1~4번째 topic 슬라이드를 순차적으로 1장씩 생성 (최대 4장).
   * 파일명 규칙: {episodeId}-topic{N}-{제목slug}.png
   */
  @Post('generate-topics/:episodeId')
  generateTopics(@Param('episodeId') episodeId: string) {
    return this.cardNewsService.generateTopics(episodeId);
  }

  @Get('latest')
  findLatestByEpisode() {
    return this.cardNewsService.findLatestByEpisode();
  }

  @Get(':id/view-count')
  getViewCount(@Param('id') id: string) {
    return this.cardNewsService.getViewCount(id);
  }

  @Post(':id/view-count')
  incrementViewCount(@Param('id') id: string) {
    return this.cardNewsService.incrementViewCount(id);
  }

  @Get(':episodeId')
  findByEpisodeId(@Param('episodeId') episodeId: string) {
    return this.cardNewsService.findByEpisodeId(episodeId);
  }
}
