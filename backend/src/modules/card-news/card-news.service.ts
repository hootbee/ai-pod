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

  /** 테스트용: 에피소드 대본에서 1장만 생성 (Gemini 2번: Director + DesignMaker) */
  async testGenerate(episodeId: string): Promise<string> {
    const episode = await this.episodesService.findOne(episodeId);
    if (!episode?.script) {
      throw new NotFoundException('에피소드 또는 대본을 찾을 수 없습니다');
    }

    // Director로 슬라이드 구성 분석 (Gemini 1번)
    this.logger.log('[TEST] Director 분석 시작');
    const cardNewsScript = await this.directorService.analyze(episode.script);

    // 첫 번째 topic 슬라이드만 처리
    const targetSlide =
      cardNewsScript.slides.find((s) => s.type === 'topic') ??
      cardNewsScript.slides[0];
    this.logger.log(`[TEST] 슬라이드 선택: "${targetSlide.title}" (keyword: ${targetSlide.imageKeyword})`);

    // Unsplash 이미지 검색
    const imageResult = await this.researcherService.findImage(targetSlide.imageKeyword);

    // DesignMaker HTML 생성 (Gemini 1번)
    const html = await this.designMakerService.generateHtml(
      targetSlide,
      cardNewsScript.theme,
      imageResult?.url,
    );

    const outputDir = process.env.CARD_NEWS_OUTPUT_DIR ?? './card-news-images';
    const outputPath = path.join(outputDir, `test-${Date.now()}.png`);
    const savedPath = await this.rendererService.renderToFile(html, outputPath);
    this.logger.log(`[TEST] PNG 저장: ${savedPath}`);
    return savedPath;
  }
}
