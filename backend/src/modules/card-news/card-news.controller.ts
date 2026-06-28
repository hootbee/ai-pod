import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CardNewsService } from './card-news.service';
import { PaginateCardNewsDto } from './dto/paginate-card-news.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { TokenPayload } from '../auth/interfaces/token.service.interface';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('card-news')
export class CardNewsController {
  constructor(private readonly cardNewsService: CardNewsService) {}

  /** 테스트: 첫 번째 topic 1장만 생성 (LLM 1회) */
  @Post('test/:episodeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  test(@Param('episodeId') episodeId: string) {
    return this.cardNewsService.testGenerate(episodeId);
  }

  /** 전체 슬라이드 생성 (표지 + 모든 topic + 마무리) */
  @Post('generate/:episodeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  generate(@Param('episodeId') episodeId: string) {
    return this.cardNewsService.generate(episodeId);
  }

  /**
   * 첫 1~4번째 topic 슬라이드를 순차적으로 1장씩 생성 (최대 4장).
   * 파일명 규칙: {episodeId}-topic{N}-{제목slug}.png
   */
  @Post('generate-topics/:episodeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  generateTopics(@Param('episodeId') episodeId: string) {
    return this.cardNewsService.generateTopics(episodeId);
  }

  /**
   * 딥다이브: 에피소드에서 가장 임팩트 있는 주제 1개를 4장 카드로 심층 설명.
   * PNG 렌더링 포함. cardType = 'deep-dive'
   */
  @Post('generate-deep-dive/:episodeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  generateDeepDive(@Param('episodeId') episodeId: string) {
    return this.cardNewsService.generateDeepDive(episodeId);
  }

  @Get('deep-dive/latest')
  findLatestDeepDive(@Query() paginateDto: PaginateCardNewsDto) {
    return this.cardNewsService.findLatestDeepDive(paginateDto);
  }

  @Get('latest')
  findLatestByEpisode(@Query() paginateDto: PaginateCardNewsDto) {
    return this.cardNewsService.findLatestByEpisode(paginateDto);
  }

  @Get(':id/view-count')
  getViewCount(@Param('id') id: string) {
    return this.cardNewsService.getViewCount(id);
  }

  @Post(':id/view-count')
  @UseGuards(JwtAuthGuard)
  incrementViewCount(
    @Param('id') id: string,
    @CurrentUser() user: TokenPayload,
  ) {
    return this.cardNewsService.incrementViewCount(id, user.sub);
  }

  @Get('deep-dive/:episodeId')
  findDeepDiveByEpisodeId(@Param('episodeId') episodeId: string) {
    return this.cardNewsService.findDeepDiveByEpisodeId(episodeId);
  }

  @Get(':episodeId')
  findByEpisodeId(@Param('episodeId') episodeId: string) {
    return this.cardNewsService.findByEpisodeId(episodeId);
  }
}
