import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { DataSource } from 'typeorm';
import { PipelineService } from './pipeline.service';
import { EpisodesService } from '../episodes/episodes.service';
import { AiProcessorService } from '../ai-processor/ai-processor.service';
import { CrawlerService } from '../crawler/crawler.service';
import { CardNewsService } from '../card-news/card-news.service';
import { HeadlineService } from '../episodes/headline.service';
import { ThumbnailService } from '../thumbnail/thumbnail.service';
import { TTS_QUEUE } from '../tts/tts.constants';

// ── 공통 Mock 팩토리 ────────────────────────────────────────────────────────

const mockEpisodesService = () => ({
  findTodayEpisode: jest.fn(),
  create: jest.fn(),
});

const mockAiProcessorService = () => ({
  processNewsBriefing: jest.fn(),
});

const mockCrawlerService = () => ({
  fetchLatest: jest.fn(),
  fetchArticleContent: jest.fn(),
  markProcessed: jest.fn(),
});

const mockCardNewsService = () => ({
  generateDeepDive: jest.fn(),
});

const mockHeadlineService = () => ({
  generateAndSave: jest.fn(),
});

const mockThumbnailService = () => ({
  generateAndSave: jest.fn().mockResolvedValue({ imagePath: '/thumbnails/test.png' }),
});

const mockDataSource = () => ({
  query: jest.fn(),
});

const mockTtsQueue = () => ({
  add: jest.fn(),
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PipelineService', () => {
  let service: PipelineService;
  let episodesService: ReturnType<typeof mockEpisodesService>;
  let aiProcessorService: ReturnType<typeof mockAiProcessorService>;
  let crawlerService: ReturnType<typeof mockCrawlerService>;
  let cardNewsService: ReturnType<typeof mockCardNewsService>;
  let ttsQueue: ReturnType<typeof mockTtsQueue>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineService,
        { provide: EpisodesService, useFactory: mockEpisodesService },
        { provide: AiProcessorService, useFactory: mockAiProcessorService },
        { provide: CrawlerService, useFactory: mockCrawlerService },
        { provide: CardNewsService, useFactory: mockCardNewsService },
        { provide: HeadlineService, useFactory: mockHeadlineService },
        { provide: ThumbnailService, useFactory: mockThumbnailService },
        { provide: DataSource, useFactory: mockDataSource },
        { provide: getQueueToken(TTS_QUEUE), useFactory: mockTtsQueue },
      ],
    }).compile();

    service = module.get(PipelineService);
    episodesService = module.get(EpisodesService);
    aiProcessorService = module.get(AiProcessorService);
    crawlerService = module.get(CrawlerService);
    cardNewsService = module.get(CardNewsService);
    ttsQueue = module.get(getQueueToken(TTS_QUEUE));

    // 기본적으로 fetch 전역 mock (Discord webhook)
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => jest.clearAllMocks());

  // ── 1. 오늘 에피소드 중복 → skip ─────────────────────────────────────────
  describe('중복 실행 방지', () => {
    it('오늘 에피소드가 이미 있으면 skipped=true 반환', async () => {
      episodesService.findTodayEpisode.mockResolvedValue({
        id: 'existing-ep',
        title: '기존',
        createdAt: new Date(),
      });

      const result = await service.runDailyPipeline();

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('today_episode_exists');
      expect(aiProcessorService.processNewsBriefing).not.toHaveBeenCalled();
    });

    it('force=true이면 오늘 에피소드 있어도 진행', async () => {
      episodesService.findTodayEpisode.mockResolvedValue({
        id: 'existing-ep',
      });
      crawlerService.fetchLatest.mockResolvedValue([]);

      const result = await service.runDailyPipeline(true);

      // 중복 체크를 건너뜀 → 기사 0건으로 insufficient_articles skip
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('insufficient_articles');
    });
  });

  // ── 2. 기사 부족 → skip ───────────────────────────────────────────────────
  describe('기사 부족 정책', () => {
    beforeEach(() => {
      episodesService.findTodayEpisode.mockResolvedValue(null);
      process.env.MIN_ARTICLES = '3';
    });

    it('기사 2건이면 skipped=true, reason=insufficient_articles', async () => {
      crawlerService.fetchLatest.mockResolvedValue([
        { link: 'http://a.com', sourceId: 's1', source: 'S1', title: 'A' },
        { link: 'http://b.com', sourceId: 's2', source: 'S2', title: 'B' },
      ]);
      crawlerService.fetchArticleContent.mockResolvedValue('content');

      const result = await service.runDailyPipeline();

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('insufficient_articles');
    });

    it('기사 3건 이상이면 진행', async () => {
      crawlerService.fetchLatest.mockResolvedValue([
        { link: 'http://a.com', sourceId: 's1', source: 'S1', title: 'A' },
        { link: 'http://b.com', sourceId: 's2', source: 'S2', title: 'B' },
        { link: 'http://c.com', sourceId: 's3', source: 'S3', title: 'C' },
      ]);
      crawlerService.fetchArticleContent.mockResolvedValue('long content here');
      aiProcessorService.processNewsBriefing.mockResolvedValue({
        title: '오늘의 뉴스',
        script: 'narrator: 테스트',
      });
      episodesService.create.mockResolvedValue({ id: 'ep-1', createdAt: new Date() });
      cardNewsService.generateDeepDive.mockResolvedValue({ id: 'cn-1', slideCount: 3 });
      ttsQueue.add.mockResolvedValue({ id: 'job-1' });

      const result = await service.runDailyPipeline();

      expect(result.skipped).toBeUndefined();
      expect(result.episodeId).toBe('ep-1');
    });
  });

  // ── 3. 정상 전체 파이프라인 ───────────────────────────────────────────────
  describe('정상 실행', () => {
    beforeEach(() => {
      episodesService.findTodayEpisode.mockResolvedValue(null);
      process.env.MIN_ARTICLES = '3';

      crawlerService.fetchLatest.mockResolvedValue([
        { link: 'http://a.com', sourceId: 's1', source: 'S1', title: 'A' },
        { link: 'http://b.com', sourceId: 's2', source: 'S2', title: 'B' },
        { link: 'http://c.com', sourceId: 's3', source: 'S3', title: 'C' },
      ]);
      crawlerService.fetchArticleContent.mockResolvedValue('long article content');
      aiProcessorService.processNewsBriefing.mockResolvedValue({
        title: '테스트 에피소드',
        script: 'narrator: 안녕하세요',
      });
      episodesService.create.mockResolvedValue({ id: 'ep-123', createdAt: new Date() });
      cardNewsService.generateDeepDive.mockResolvedValue({ id: 'cn-456', slideCount: 3 });
      ttsQueue.add.mockResolvedValue({ id: 'job-789' });
    });

    it('에피소드, 카드뉴스, TTS 모두 성공', async () => {
      const result = await service.runDailyPipeline();

      expect(result.episodeId).toBe('ep-123');
      expect(result.cardNewsId).toBe('cn-456');
      expect(result.ttsJobId).toBe('job-789');
      expect(result.warnings).toHaveLength(0);
    });

    it('개별 기사 fetch 실패해도 성공한 기사로 진행', async () => {
      crawlerService.fetchArticleContent
        .mockRejectedValueOnce(new Error('fetch fail'))
        .mockResolvedValue('content');

      crawlerService.fetchLatest.mockResolvedValue([
        { link: 'http://fail.com', sourceId: 's0', source: 'S0', title: 'FAIL' },
        { link: 'http://a.com', sourceId: 's1', source: 'S1', title: 'A' },
        { link: 'http://b.com', sourceId: 's2', source: 'S2', title: 'B' },
        { link: 'http://c.com', sourceId: 's3', source: 'S3', title: 'C' },
      ]);

      const result = await service.runDailyPipeline();

      expect(result.episodeId).toBe('ep-123');
      expect(result.warnings).toHaveLength(0);
    });
  });

  // ── 4. LLM 실패 → 재시도 → 중단 ─────────────────────────────────────────
  describe('LLM 실패 처리', () => {
    beforeEach(() => {
      episodesService.findTodayEpisode.mockResolvedValue(null);
      process.env.MIN_ARTICLES = '3';

      crawlerService.fetchLatest.mockResolvedValue([
        { link: 'http://a.com', sourceId: 's1', source: 'S1', title: 'A' },
        { link: 'http://b.com', sourceId: 's2', source: 'S2', title: 'B' },
        { link: 'http://c.com', sourceId: 's3', source: 'S3', title: 'C' },
      ]);
      crawlerService.fetchArticleContent.mockResolvedValue('content');
    });

    it('LLM 2회 연속 실패 시 예외 throw', async () => {
      aiProcessorService.processNewsBriefing.mockRejectedValue(new Error('API error'));

      await expect(service.runDailyPipeline()).rejects.toThrow('API error');
      expect(aiProcessorService.processNewsBriefing).toHaveBeenCalledTimes(2);
    });

    it('LLM 1회 실패 후 재시도 성공', async () => {
      aiProcessorService.processNewsBriefing
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValueOnce({ title: '복구 성공', script: 'narrator: ok' });

      episodesService.create.mockResolvedValue({ id: 'ep-retry', createdAt: new Date() });
      cardNewsService.generateDeepDive.mockResolvedValue({ id: 'cn-retry', slideCount: 1 });
      ttsQueue.add.mockResolvedValue({ id: 'job-retry' });

      const result = await service.runDailyPipeline();

      expect(result.episodeId).toBe('ep-retry');
      expect(aiProcessorService.processNewsBriefing).toHaveBeenCalledTimes(2);
    });
  });

  // ── 5. 카드뉴스 실패 → 에피소드 유지 ────────────────────────────────────
  describe('카드뉴스 부분 실패', () => {
    beforeEach(() => {
      episodesService.findTodayEpisode.mockResolvedValue(null);
      process.env.MIN_ARTICLES = '3';
      crawlerService.fetchLatest.mockResolvedValue([
        { link: 'http://a.com', sourceId: 's1', source: 'S1', title: 'A' },
        { link: 'http://b.com', sourceId: 's2', source: 'S2', title: 'B' },
        { link: 'http://c.com', sourceId: 's3', source: 'S3', title: 'C' },
      ]);
      crawlerService.fetchArticleContent.mockResolvedValue('content');
      aiProcessorService.processNewsBriefing.mockResolvedValue({ title: 'T', script: 'S' });
      episodesService.create.mockResolvedValue({ id: 'ep-ok', createdAt: new Date() });
      ttsQueue.add.mockResolvedValue({ id: 'job-ok' });
    });

    it('카드뉴스 실패해도 에피소드 ID 반환, warnings에 기록', async () => {
      cardNewsService.generateDeepDive.mockRejectedValue(new Error('director fail'));

      const result = await service.runDailyPipeline();

      expect(result.episodeId).toBe('ep-ok');
      expect(result.cardNewsId).toBeUndefined();
      expect(result.ttsJobId).toBe('job-ok'); // TTS는 계속 진행됨
      expect(result.warnings[0]).toContain('카드뉴스 생성 실패');
    });
  });

  // ── 6. TTS 실패 → 에피소드·카드뉴스 유지 ────────────────────────────────
  describe('TTS 부분 실패', () => {
    beforeEach(() => {
      episodesService.findTodayEpisode.mockResolvedValue(null);
      process.env.MIN_ARTICLES = '3';
      crawlerService.fetchLatest.mockResolvedValue([
        { link: 'http://a.com', sourceId: 's1', source: 'S1', title: 'A' },
        { link: 'http://b.com', sourceId: 's2', source: 'S2', title: 'B' },
        { link: 'http://c.com', sourceId: 's3', source: 'S3', title: 'C' },
      ]);
      crawlerService.fetchArticleContent.mockResolvedValue('content');
      aiProcessorService.processNewsBriefing.mockResolvedValue({ title: 'T', script: 'S' });
      episodesService.create.mockResolvedValue({ id: 'ep-ok', createdAt: new Date() });
      cardNewsService.generateDeepDive.mockResolvedValue({ id: 'cn-ok', slideCount: 2 });
    });

    it('TTS 실패해도 에피소드·카드뉴스 유지, warnings에 기록', async () => {
      ttsQueue.add.mockRejectedValue(new Error('redis down'));

      const result = await service.runDailyPipeline();

      expect(result.episodeId).toBe('ep-ok');
      expect(result.cardNewsId).toBe('cn-ok');
      expect(result.ttsJobId).toBeUndefined();
      expect(result.warnings[0]).toContain('TTS 큐 등록 실패');
    });
  });

  // ── 7. retryWithTimeout 독립 테스트 ──────────────────────────────────────
  describe('retryWithTimeout', () => {
    it('timeout 초과 시 에러 throw', async () => {
      const neverResolves = () => new Promise<void>(() => {});
      await expect(service.retryWithTimeout(neverResolves, 50, 1)).rejects.toThrow('Timeout');
    });
  });
});
