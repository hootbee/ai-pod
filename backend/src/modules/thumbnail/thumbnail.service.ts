import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import { EpisodeThumbnail } from '../episodes/entities/episode-thumbnail.entity';
import { ThumbnailPromptService } from './thumbnail-prompt.service';
import { ThumbnailGeneratorService } from './thumbnail-generator.service';
import { PodcastEpisode } from '../episodes/entities/podcast-episode.entity';
import { toPublicMediaPath } from '../../common/media-path.util';

/**
 * 책임: 썸네일 생성 오케스트레이션 + DB CRUD (SRP)
 * - PromptService, GeneratorService를 조합해 단일 진입점 제공
 * - episodeId UNIQUE → upsert로 재생성 허용
 */
@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);

  constructor(
    @InjectRepository(EpisodeThumbnail)
    private readonly thumbnailRepository: Repository<EpisodeThumbnail>,
    @InjectRepository(PodcastEpisode)
    private readonly episodeRepository: Repository<PodcastEpisode>,
    private readonly promptService: ThumbnailPromptService,
    private readonly generatorService: ThumbnailGeneratorService,
  ) {}

  /**
   * 에피소드 썸네일 생성 + DB 저장 (1:1 upsert)
   * 이미 있으면 덮어씀
   */
  async generateAndSave(episodeId: string): Promise<EpisodeThumbnail> {
    const episode = await this.episodeRepository.findOne({ where: { id: episodeId } });
    if (!episode) throw new NotFoundException(`에피소드를 찾을 수 없습니다: ${episodeId}`);

    if (!episode.headline || !episode.headlineSubtitle) {
      throw new Error('헤드라인 또는 부제가 없습니다. 먼저 generate-headline을 실행하세요.');
    }

    // 1. 프롬프트 빌드
    this.logger.log(`[Thumbnail] 프롬프트 생성: ${episode.headline}`);
    const prompt = await this.promptService.buildPrompt(
      episode.headline,
      episode.headlineSubtitle,
    );

    // 2. 이미지 생성 및 파일 저장
    const outputDir = process.env.THUMBNAIL_OUTPUT_DIR ?? './thumbnails';
    const dateStr = new Date(episode.createdAt).toISOString().slice(0, 10).replace(/-/g, '');
    const outputPath = path.join(outputDir, `${dateStr}-${episodeId.slice(0, 8)}-thumbnail.png`);

    this.logger.log(`[Thumbnail] 이미지 생성 시작`);
    const imagePath = await this.generatorService.generate(prompt, outputPath);

    // 3. DB upsert (episodeId UNIQUE → 중복 시 업데이트)
    await this.thumbnailRepository
      .createQueryBuilder()
      .insert()
      .into(EpisodeThumbnail)
      .values({ episodeId, imagePath, prompt })
      .orUpdate(['imagePath', 'prompt'], ['episodeId'])
      .execute();

    const saved = await this.thumbnailRepository.findOneOrFail({ where: { episodeId } });
    this.logger.log(`[Thumbnail] DB 저장 완료: ${saved.id}`);
    return this.withPublicPath(saved);
  }

  /** 에피소드 썸네일 조회 */
  async findByEpisodeId(episodeId: string): Promise<EpisodeThumbnail | null> {
    const thumbnail = await this.thumbnailRepository.findOne({ where: { episodeId } });
    return thumbnail ? this.withPublicPath(thumbnail) : null;
  }

  private withPublicPath(thumbnail: EpisodeThumbnail): EpisodeThumbnail {
    return {
      ...thumbnail,
      imagePath: toPublicMediaPath(thumbnail.imagePath, '/thumbnails') ?? thumbnail.imagePath,
    };
  }
}
