import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import Redis from 'ioredis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { CrawlerService } from '../crawler/crawler.service';
import { AiProcessorService } from '../ai-processor/ai-processor.service';
import { EpisodesService } from '../episodes/episodes.service';
import { HeadlineService } from '../episodes/headline.service';
import { CardNewsService } from '../card-news/card-news.service';
import { ThumbnailService } from '../thumbnail/thumbnail.service';
import { TTS_JOB, TTS_QUEUE } from '../tts/tts.constants';
import type { BriefingArticle } from '../ai-processor/interfaces/ai-provider.interface';

const PIPELINE_LOCK_KEY = 'pipeline:daily:lock';
const PIPELINE_LOCK_TTL_SEC = 2 * 60 * 60; // 2시간

export interface PipelineResult {
  skipped?: boolean;
  reason?: string;
  episodeId?: string;
  cardNewsId?: string;
  ttsJobId?: string | number;
  warnings: string[];
}

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly crawlerService: CrawlerService,
    private readonly aiProcessorService: AiProcessorService,
    private readonly episodesService: EpisodesService,
    private readonly headlineService: HeadlineService,
    private readonly cardNewsService: CardNewsService,
    private readonly thumbnailService: ThumbnailService,
    private readonly dataSource: DataSource,
    @InjectQueue(TTS_QUEUE) private readonly ttsQueue: Queue,
  ) {}

  /**
   * 전체 파이프라인 실행
   * @param force true이면 오늘 에피소드가 있어도 재실행
   */
  async runDailyPipeline(force = false): Promise<PipelineResult> {
    const warnings: string[] = [];

    // ── 0. 중복 실행 방지 (오늘 에피소드 체크) ──────────────────────────
    if (!force) {
      const todayEpisode = await this.episodesService.findTodayEpisode();
      if (todayEpisode) {
        this.logger.warn(`[Pipeline] 오늘 에피소드 이미 존재: ${todayEpisode.id}`);
        return { skipped: true, reason: 'today_episode_exists', episodeId: todayEpisode.id, warnings };
      }
    }

    // ── 1. 크롤링 ────────────────────────────────────────────────────────
    this.logger.log('[Pipeline] 크롤링 시작');
    const { articles, sources } = await this.collectArticlesSafely();

    const minArticles = Number(process.env.MIN_ARTICLES ?? 3);
    if (articles.length < minArticles) {
      this.logger.log(`[Pipeline] 기사 부족 (${articles.length}건) → skip`);
      return { skipped: true, reason: 'insufficient_articles', warnings };
    }

    // ── 2. AI 스크립트 생성 (timeout + 재시도) ────────────────────────────
    this.logger.log(`[Pipeline] AI 스크립트 생성 (기사 ${articles.length}건)`);
    const briefing = await this.retryWithTimeout(
      () => this.aiProcessorService.processNewsBriefing(articles),
      60_000,
      2,
    );

    // ── 3. DB 에피소드 저장 ───────────────────────────────────────────────
    const episode = await this.episodesService.create({
      title: briefing.title,
      script: briefing.script,
      sourceCount: articles.length,
      sources,
    });
    this.logger.log(`[Pipeline] 에피소드 저장 완료: ${episode.id}`);

    const result: PipelineResult = { episodeId: episode.id, warnings };

    // ── 3.5. 헤드라인 + 부제 생성 (실패해도 에피소드 유지) ────────────────
    try {
      await this.headlineService.generateAndSave(episode.id);
      this.logger.log(`[Pipeline] 헤드라인 생성 완료`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`헤드라인 생성 실패: ${msg}`);
      this.logger.warn(`[Pipeline] 헤드라인 실패 (에피소드 유지) → ${msg}`);
    }

    // ── 3.6. 썸네일 생성 (실패해도 에피소드 유지) ──────────────────────────
    try {
      const thumbnail = await this.thumbnailService.generateAndSave(episode.id);
      this.logger.log(`[Pipeline] 썸네일 생성 완료: ${thumbnail.imagePath}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`썸네일 생성 실패: ${msg}`);
      this.logger.warn(`[Pipeline] 썸네일 실패 (에피소드 유지) → ${msg}`);
    }

    // ── 4. 카드뉴스 생성 (실패해도 에피소드 유지) ─────────────────────────
    try {
      const cardNews = await this.cardNewsService.generateTopics(episode.id);
      result.cardNewsId = cardNews.id;
      this.logger.log(`[Pipeline] 카드뉴스 생성 완료: ${cardNews.id} (${cardNews.slideCount}장)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`카드뉴스 생성 실패: ${msg}`);
      this.logger.warn(`[Pipeline] 카드뉴스 실패 (에피소드 유지) → ${msg}`);
    }

    // ── 5. TTS 큐 등록 (실패해도 에피소드 유지) ──────────────────────────
    try {
      const job = await this.ttsQueue.add(TTS_JOB.GENERATE, { episodeId: episode.id });
      result.ttsJobId = job.id;
      this.logger.log(`[Pipeline] TTS 큐 등록 완료: jobId=${job.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`TTS 큐 등록 실패: ${msg}`);
      this.logger.warn(`[Pipeline] TTS 실패 (에피소드 유지) → ${msg}`);
    }

    // ── 6. Discord 웹훅 알림 ─────────────────────────────────────────────
    await this.sendWebhook(result);

    return result;
  }

  /** 카드뉴스만 재트리거 */
  async retryCardNews(episodeId: string) {
    const cardNews = await this.cardNewsService.generateTopics(episodeId);
    this.logger.log(`[Pipeline] 카드뉴스 재생성 완료: ${cardNews.id}`);
    return cardNews;
  }

  /** TTS만 재트리거 */
  async retryTts(episodeId: string) {
    const job = await this.ttsQueue.add(TTS_JOB.GENERATE, { episodeId });
    this.logger.log(`[Pipeline] TTS 재큐 등록 완료: jobId=${job.id}`);
    return { jobId: job.id, episodeId, status: 'queued' };
  }

  /** DB/캐시/생성 파일 전체 초기화 후 파이프라인 실행 */
  async resetAndRun(force = true): Promise<PipelineResult & { reset: { ok: true } }> {
    this.logger.warn('[Pipeline] reset-and-run 시작: DB/Redis/파일 초기화 수행');
    await this.resetRuntimeState();
    const result = await this.runDailyPipeline(force);
    return { ...result, reset: { ok: true } };
  }

  // ── private helpers ───────────────────────────────────────────────────

  /** 개별 기사 fetch 실패 시 skip, 성공한 것만 반환 */
  private async collectArticlesSafely(): Promise<{
    articles: BriefingArticle[];
    sources: Array<{ title: string; source: string; link: string }>;
  }> {
    const LIMIT_PER_SOURCE = 5;
    const MAX_ARTICLES = 15;

    const items = await this.crawlerService.fetchLatest(LIMIT_PER_SOURCE);
    const candidates = items.slice(0, MAX_ARTICLES);

    const articles: BriefingArticle[] = [];
    const sources: Array<{ title: string; source: string; link: string }> = [];
    for (const item of candidates) {
      try {
        const content = await this.crawlerService.fetchArticleContent(item.link, item.sourceId);
        if (!content) continue;
        articles.push({ title: item.title, content: content.slice(0, 1500), source: item.source });
        sources.push({ title: item.title, source: item.source, link: item.link });
        await this.crawlerService.markProcessed(item);
      } catch {
        this.logger.warn(`[Pipeline] 기사 fetch 실패, skip: ${item.link}`);
      }
    }
    return { articles, sources };
  }

  /** Promise에 timeout + retryCount 적용 */
  async retryWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    retries: number,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs),
          ),
        ]);
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`[Pipeline] 시도 ${attempt}/${retries} 실패: ${msg}`);
        if (attempt < retries) await new Promise((r) => setTimeout(r, 2000));
      }
    }
    throw lastError;
  }

  /** Discord/Slack 웹훅 알림 */
  private async sendWebhook(result: PipelineResult): Promise<void> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
    let content: string;

    if (result.skipped) {
      content = `ℹ️ [${today}] 파이프라인 skip: ${result.reason}`;
    } else if (result.warnings.length > 0) {
      content = `⚠️ [${today}] 발행 완료 (경고 있음)\n에피소드: ${result.episodeId}\n경고:\n${result.warnings.map((w) => `  - ${w}`).join('\n')}`;
    } else {
      content = `✅ [${today}] AiPod 발행 완료\n에피소드: ${result.episodeId}\n카드뉴스: ${result.cardNewsId ?? '없음'}\nTTS Job: ${result.ttsJobId ?? '없음'}`;
    }

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
    } catch (err) {
      this.logger.warn(`[Pipeline] 웹훅 발송 실패: ${err instanceof Error ? err.message : err}`);
    }
  }

  private async resetRuntimeState(): Promise<void> {
    await this.resetDatabase();
    await this.resetRedis();
    await this.resetGeneratedFiles();
  }

  private async resetDatabase(): Promise<void> {
    // 참조 제약(FK) 고려해 CASCADE TRUNCATE 사용
    await this.dataSource.query(`
      TRUNCATE TABLE
        card_news,
        episode_thumbnails,
        podcast_episodes,
        refresh_tokens,
        users
      RESTART IDENTITY CASCADE
    `);
    this.logger.warn('[Pipeline] DB 테이블 초기화 완료');
  }

  private async resetRedis(): Promise<void> {
    await this.ttsQueue.obliterate({ force: true });

    const redisUrl = process.env.REDIS_URL;
    const client = redisUrl ? new Redis(redisUrl) : new Redis();
    try {
      const pattern = 'crawler:processed:*';
      let cursor = '0';
      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await client.del(...keys);
        }
      } while (cursor !== '0');
    } finally {
      await client.quit();
    }

    this.logger.warn('[Pipeline] Redis 큐/캐시 초기화 완료');
  }

  private async resetGeneratedFiles(): Promise<void> {
    const dirs = [
      path.resolve(process.env.AUDIO_OUTPUT_DIR ?? './audio-files'),
      path.resolve(process.env.CARD_NEWS_OUTPUT_DIR ?? './card-news-images'),
      path.resolve(process.env.THUMBNAIL_OUTPUT_DIR ?? './thumbnails'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        await fs.rm(path.join(dir, entry), { recursive: true, force: true });
      }
    }

    this.logger.warn('[Pipeline] 생성 파일 초기화 완료');
  }
}
