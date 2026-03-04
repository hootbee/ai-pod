import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { CrawlerService } from '../crawler/crawler.service';
import { AiProcessorService } from '../ai-processor/ai-processor.service';
import { EpisodesService } from '../episodes/episodes.service';
import { CardNewsService } from '../card-news/card-news.service';
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
    private readonly cardNewsService: CardNewsService,
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
    const articles = await this.collectArticlesSafely();

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
    });
    this.logger.log(`[Pipeline] 에피소드 저장 완료: ${episode.id}`);

    const result: PipelineResult = { episodeId: episode.id, warnings };

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

  // ── private helpers ───────────────────────────────────────────────────

  /** 개별 기사 fetch 실패 시 skip, 성공한 것만 반환 */
  private async collectArticlesSafely(): Promise<BriefingArticle[]> {
    const LIMIT_PER_SOURCE = 5;
    const MAX_ARTICLES = 15;

    const items = await this.crawlerService.fetchLatest(LIMIT_PER_SOURCE);
    const candidates = items.slice(0, MAX_ARTICLES);

    const articles: BriefingArticle[] = [];
    for (const item of candidates) {
      try {
        const content = await this.crawlerService.fetchArticleContent(item.link, item.sourceId);
        if (!content) continue;
        articles.push({ title: item.title, content: content.slice(0, 1500), source: item.source });
        await this.crawlerService.markProcessed(item);
      } catch {
        this.logger.warn(`[Pipeline] 기사 fetch 실패, skip: ${item.link}`);
      }
    }
    return articles;
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
}
