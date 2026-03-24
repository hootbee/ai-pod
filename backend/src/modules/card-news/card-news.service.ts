import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import { CardNews } from './entities/card-news.entity';
import { CardNewsViewLog } from './entities/card-news-view-log.entity';
import { PaginateCardNewsDto } from './dto/paginate-card-news.dto';
import { DirectorService } from './director.service';
import { DesignMakerService } from './design-maker.service';
import { RendererService } from './renderer.service';
import { ResearcherService } from './researcher.service';
import { EpisodesService } from '../episodes/episodes.service';
import { PaginatedResponse, toPaginatedResponse } from '../../common/dto/paginated-response.dto';

@Injectable()
export class CardNewsService {
  private readonly logger = new Logger(CardNewsService.name);

  constructor(
    @InjectRepository(CardNews)
    private readonly cardNewsRepository: Repository<CardNews>,
    @InjectRepository(CardNewsViewLog)
    private readonly viewLogRepository: Repository<CardNewsViewLog>,
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

    // 1단계: Director — 슬라이드 구성 분석
    this.logger.log(`[1] Director 분석 시작: episodeId=${episodeId}`);
    const cardNewsScript = await this.directorService.analyze(episode.script);
    this.logger.log(`[1] Director 완료: 슬라이드 ${cardNewsScript.slides.length}장 구성`);

    const outputDir = process.env.CARD_NEWS_OUTPUT_DIR ?? './card-news-images';
    const imagePaths: string[] = [];

    // 2단계: 각 슬라이드별 이미지 수급 → HTML 생성 → PNG 렌더링
    for (let i = 0; i < cardNewsScript.slides.length; i++) {
      const slide = cardNewsScript.slides[i];
      this.logger.log(`[슬라이드 ${i + 1}/${cardNewsScript.slides.length}] type=${slide.type}`);

      // 이미지 검색 (마무리 슬라이드는 이미지 스킵 가능)
      const imageResult = slide.type !== 'closing'
        ? await this.researcherService.findImage(slide.imageKeyword)
        : null;

      // 원본 이미지 URL 저장 (프론트에서 raw 이미지로 사용)
      slide.imageUrl = imageResult?.url ?? null;

      // HTML 생성
      const html = await this.designMakerService.generateHtml(
        slide,
        cardNewsScript.theme,
        imageResult?.url,
      );

      // PNG 렌더링
      const filename = `${episodeId}-slide${i + 1}-${Date.now()}.png`;
      const outputPath = path.join(outputDir, filename);
      const savedPath = await this.rendererService.renderToFile(html, outputPath);
      imagePaths.push(savedPath);
      this.logger.log(`[슬라이드 ${i + 1}] PNG 저장: ${savedPath}`);
    }

    const cardNews = this.cardNewsRepository.create({
      episodeId,
      imagePaths,
      slideCount: imagePaths.length,
      scriptSnapshot: cardNewsScript as unknown as Record<string, unknown>,
    });

    return this.cardNewsRepository.save(cardNews);
  }

  async findByEpisodeId(episodeId: string): Promise<CardNews[]> {
    return this.cardNewsRepository.find({
      where: { episodeId },
      order: { createdAt: 'DESC' },
    });
  }

  async findLatestByEpisode(dto: PaginateCardNewsDto): Promise<PaginatedResponse<CardNews>> {
    const limit = dto.limit ?? 10;
    const offset = dto.offset ?? 0;

    // 카드뉴스가 존재하는 고유 에피소드 수 조회
    const totalCount: number = await this.cardNewsRepository
      .createQueryBuilder('cardNews')
      .select('COUNT(DISTINCT cardNews.episodeId)', 'count')
      .getRawOne()
      .then((r) => Number(r?.count ?? 0));

    const rows = await this.cardNewsRepository
      .createQueryBuilder('cardNews')
      .leftJoinAndSelect('cardNews.episode', 'episode')
      .select([
        'cardNews.id',
        'cardNews.episodeId',
        'cardNews.imagePaths',
        'cardNews.slideCount',
        'cardNews.scriptSnapshot',
        'cardNews.createdAt',
        'episode.id',
        'episode.createdAt',
      ])
      .distinctOn(['cardNews.episodeId'])
      .orderBy('cardNews.episodeId', 'ASC')
      .addOrderBy('cardNews.createdAt', 'DESC')
      .take(limit)
      .skip(offset)
      .getMany();

    const sortedRows = rows.sort((a, b) => {
      const aTime = a.episode?.createdAt?.getTime() ?? a.createdAt.getTime();
      const bTime = b.episode?.createdAt?.getTime() ?? b.createdAt.getTime();
      return bTime - aTime;
    });

    return toPaginatedResponse(sortedRows, totalCount, limit, offset);
  }

  async incrementViewCount(id: string, userId: string): Promise<{ alreadyCounted: boolean }> {
    const existing = await this.viewLogRepository.findOne({ where: { userId, cardNewsId: id } });
    if (existing) return { alreadyCounted: true };

    await this.viewLogRepository.save(this.viewLogRepository.create({ userId, cardNewsId: id }));
    await this.cardNewsRepository.increment({ id }, 'viewCount', 1);
    return { alreadyCounted: false };
  }

  async getViewCount(id: string): Promise<{ cardNewsId: string; viewCount: number }> {
    const cardNews = await this.cardNewsRepository.findOne({
      where: { id },
      select: ['id', 'viewCount'],
    });
    if (!cardNews) {
      throw new NotFoundException(`CardNews not found: ${id}`);
    }
    return {
      cardNewsId: cardNews.id,
      viewCount: cardNews.viewCount,
    };
  }

  /** 첫 번째 topic 슬라이드 1장 테스트 생성 (LLM 1회 호출) */
  async testGenerate(episodeId: string): Promise<string> {
    const episode = await this.episodesService.findOne(episodeId);
    if (!episode?.script) {
      throw new NotFoundException('에피소드 또는 대본을 찾을 수 없습니다');
    }

    this.logger.log('[TEST] Director 분석 시작');
    const cardNewsScript = await this.directorService.analyze(episode.script);

    const targetSlide =
      cardNewsScript.slides.find((s) => s.type === 'topic') ??
      cardNewsScript.slides[0];
    this.logger.log(`[TEST] 슬라이드 선택: "${targetSlide.title}" (keyword: ${targetSlide.imageKeyword})`);

    const imageResult = await this.researcherService.findImage(targetSlide.imageKeyword);
    const html = await this.designMakerService.generateHtml(
      targetSlide,
      cardNewsScript.theme,
      imageResult?.url,
    );

    const outputDir = process.env.CARD_NEWS_OUTPUT_DIR ?? './card-news-images';
    // 파일명: {YYYYMMDD}-{episodeId 앞 8자}-topic1-{imageKeyword}.png (날짜는 에피소드 생성일 기준)
    const dateStr = new Date(episode.createdAt).toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const keyword = targetSlide.imageKeyword.replace(/\s+/g, '-').toLowerCase();
    const outputPath = path.join(outputDir, `${dateStr}-${episodeId.slice(0, 8)}-topic1-${keyword}.png`);
    const savedPath = await this.rendererService.renderToFile(html, outputPath);
    this.logger.log(`[TEST] PNG 저장: ${savedPath}`);
    return savedPath;
  }

  /**
   * 첫 번째~네 번째 토픽 슬라이드를 순차적으로 1장씩 생성 (총 최대 4장).
   * - LLM 1회 호출(Director)로 전체 구성을 분석 후
   * - topic 슬라이드 최대 4개를 순차 렌더링하여 DB에 저장
   * 파일명 규칙: {episodeId}-topic{N}-{제목slug}.png
   */
  async generateTopics(episodeId: string): Promise<CardNews> {
    const episode = await this.episodesService.findOne(episodeId);
    if (!episode?.script) {
      throw new NotFoundException('에피소드 또는 대본을 찾을 수 없습니다');
    }

    this.logger.log(`[TOPICS] Director 분석 시작: episodeId=${episodeId}`);
    const cardNewsScript = await this.directorService.analyze(episode.script);

    // topic 타입 슬라이드만 추출, 최대 4개
    const topicSlides = cardNewsScript.slides
      .filter((s) => s.type === 'topic')
      .slice(0, 4);

    if (topicSlides.length === 0) {
      throw new NotFoundException('대본에서 topic 슬라이드를 찾을 수 없습니다');
    }

    this.logger.log(`[TOPICS] 처리할 토픽 수: ${topicSlides.length}장`);

    const outputDir = process.env.CARD_NEWS_OUTPUT_DIR ?? './card-news-images';
    const imagePaths: string[] = [];

    for (let i = 0; i < topicSlides.length; i++) {
      const slide = topicSlides[i];
      const topicNumber = i + 1;
      this.logger.log(`[TOPICS] 토픽 ${topicNumber}/${topicSlides.length} 처리 중: "${slide.title}"`);

      // Unsplash 이미지 검색
      const imageResult = await this.researcherService.findImage(slide.imageKeyword);

      // 원본 이미지 URL 저장 (프론트에서 raw 이미지로 사용)
      slide.imageUrl = imageResult?.url ?? null;

      // HTML 생성 (정적 템플릿, LLM 호출 없음)
      const html = await this.designMakerService.generateHtml(
        slide,
        cardNewsScript.theme,
        imageResult?.url,
      );

      // 파일명: {YYYYMMDD}-{episodeId 앞 8자}-topic{N}-{imageKeyword}.png (날짜는 에피소드 생성일 기준)
      const dateStr = new Date(episode.createdAt).toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
      const keyword = slide.imageKeyword.replace(/\s+/g, '-').toLowerCase();
      const filename = `${dateStr}-${episodeId.slice(0, 8)}-topic${topicNumber}-${keyword}.png`;
      const outputPath = path.join(outputDir, filename);
      const savedPath = await this.rendererService.renderToFile(html, outputPath);
      imagePaths.push(savedPath);
      this.logger.log(`[TOPICS] 토픽 ${topicNumber} PNG 저장: ${savedPath}`);
    }

    // DB에 저장: imagePaths 배열에 4장(또는 그 이하) 경로 저장
    const cardNews = this.cardNewsRepository.create({
      episodeId,
      imagePaths,
      slideCount: imagePaths.length,
      scriptSnapshot: cardNewsScript as unknown as Record<string, unknown>,
    });

    return this.cardNewsRepository.save(cardNews);
  }
}
