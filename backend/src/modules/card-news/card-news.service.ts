import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import { CardNews } from './entities/card-news.entity';
import { DirectorService } from './director.service';
import { DesignMakerService } from './design-maker.service';
import { RendererService } from './renderer.service';
import { ResearcherService } from './researcher.service';
import { EpisodesService } from '../episodes/episodes.service';

@Injectable()
export class CardNewsService {
  private readonly logger = new Logger(CardNewsService.name);

  constructor(
    @InjectRepository(CardNews)
    private readonly cardNewsRepository: Repository<CardNews>,
    private readonly episodesService: EpisodesService,
    private readonly directorService: DirectorService,
    private readonly researcherService: ResearcherService,
    private readonly designMakerService: DesignMakerService,
    private readonly rendererService: RendererService,
  ) {}

  async generate(episodeId: string): Promise<CardNews> {
    const episode = await this.episodesService.findOne(episodeId);
    if (!episode?.script) {
      throw new NotFoundException('에피소드 또는 대본을 찾을 수 없습니다');
    }

    this.logger.log(`[1/4] 디렉터 분석 시작: episodeId=${episodeId}`);
    const direction = await this.directorService.analyze(episode.script);
    this.logger.log(`[1/4] 디렉터 완료: theme=${direction.theme}, mood=${direction.mood}`);

    this.logger.log('[2/4] 리서처 이미지 검색 시작');
    const imageResult = await this.researcherService.findImage(direction.imageKeywords);
    this.logger.log(`[2/4] 이미지 ${imageResult ? '획득: ' + imageResult.url : '없음 (CSS 폴백 사용)'}`);

    this.logger.log('[3/4] 디자인 메이커 HTML 생성 시작');
    const html = await this.designMakerService.generateHtml(direction, imageResult?.url);
    this.logger.log('[3/4] HTML 생성 완료');

    const outputDir = process.env.CARD_NEWS_OUTPUT_DIR ?? './card-news-images';
    const filename = `${episodeId}-${Date.now()}.png`;
    const outputPath = path.join(outputDir, filename);

    this.logger.log('[4/4] Puppeteer PNG 렌더링 시작');
    const savedPath = await this.rendererService.renderToFile(html, outputPath);
    this.logger.log(`[4/4] 렌더링 완료: ${savedPath}`);

    const cardNews = this.cardNewsRepository.create({
      episodeId,
      imagePath: savedPath,
      designDirection: direction as unknown as Record<string, unknown>,
    });

    return this.cardNewsRepository.save(cardNews);
  }

  async findByEpisodeId(episodeId: string): Promise<CardNews[]> {
    return this.cardNewsRepository.find({
      where: { episodeId },
      order: { createdAt: 'DESC' },
    });
  }
}
