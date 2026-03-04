import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PipelineController } from '../src/modules/pipeline/pipeline.controller';
import { PipelineService } from '../src/modules/pipeline/pipeline.service';

/**
 * 파이프라인 통합 테스트 (E2E)
 * - 실제 DB/Redis/외부 API 대신 PipelineService를 완전히 mock
 * - HTTP 엔드포인트 → 서비스 호출 흐름만 검증
 */
describe('PipelineController (e2e)', () => {
  let app: INestApplication;
  let pipelineService: jest.Mocked<PipelineService>;

  const mockPipelineService: Partial<jest.Mocked<PipelineService>> = {
    runDailyPipeline: jest.fn(),
    retryCardNews: jest.fn(),
    retryTts: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PipelineController],
      providers: [
        { provide: PipelineService, useValue: mockPipelineService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    pipelineService = app.get(PipelineService) as jest.Mocked<PipelineService>;
  });

  afterAll(() => app.close());
  afterEach(() => jest.clearAllMocks());

  // ── POST /pipeline/run ────────────────────────────────────────────────────
  describe('POST /pipeline/run', () => {
    it('정상 실행 시 201 + 결과 반환', async () => {
      mockPipelineService.runDailyPipeline!.mockResolvedValue({
        episodeId: 'ep-abc',
        cardNewsId: 'cn-abc',
        ttsJobId: 'job-abc',
        warnings: [],
      });

      const res = await request(app.getHttpServer())
        .post('/pipeline/run')
        .expect(201);

      expect(res.body.episodeId).toBe('ep-abc');
      expect(mockPipelineService.runDailyPipeline).toHaveBeenCalledWith(false);
    });

    it('?force=true 이면 force=true로 서비스 호출', async () => {
      mockPipelineService.runDailyPipeline!.mockResolvedValue({
        episodeId: 'ep-force',
        warnings: [],
      });

      await request(app.getHttpServer())
        .post('/pipeline/run?force=true')
        .expect(201);

      expect(mockPipelineService.runDailyPipeline).toHaveBeenCalledWith(true);
    });

    it('오늘 이미 실행된 경우 skipped=true 반환', async () => {
      mockPipelineService.runDailyPipeline!.mockResolvedValue({
        skipped: true,
        reason: 'today_episode_exists',
        warnings: [],
      });

      const res = await request(app.getHttpServer())
        .post('/pipeline/run')
        .expect(201);

      expect(res.body.skipped).toBe(true);
      expect(res.body.reason).toBe('today_episode_exists');
    });

    it('기사 부족 시 skipped=true, reason=insufficient_articles', async () => {
      mockPipelineService.runDailyPipeline!.mockResolvedValue({
        skipped: true,
        reason: 'insufficient_articles',
        warnings: [],
      });

      const res = await request(app.getHttpServer())
        .post('/pipeline/run')
        .expect(201);

      expect(res.body.reason).toBe('insufficient_articles');
    });
  });

  // ── POST /pipeline/retry-cardnews/:episodeId ──────────────────────────────
  describe('POST /pipeline/retry-cardnews/:episodeId', () => {
    it('카드뉴스 재생성 성공', async () => {
      mockPipelineService.retryCardNews!.mockResolvedValue({
        id: 'cn-retry',
        slideCount: 3,
      } as any);

      const res = await request(app.getHttpServer())
        .post('/pipeline/retry-cardnews/ep-123')
        .expect(201);

      expect(res.body.id).toBe('cn-retry');
      expect(mockPipelineService.retryCardNews).toHaveBeenCalledWith('ep-123');
    });
  });

  // ── POST /pipeline/retry-tts/:episodeId ──────────────────────────────────
  describe('POST /pipeline/retry-tts/:episodeId', () => {
    it('TTS 재트리거 성공', async () => {
      mockPipelineService.retryTts!.mockResolvedValue({
        jobId: 'job-retry',
        episodeId: 'ep-123',
        status: 'queued',
      });

      const res = await request(app.getHttpServer())
        .post('/pipeline/retry-tts/ep-123')
        .expect(201);

      expect(res.body.jobId).toBe('job-retry');
      expect(mockPipelineService.retryTts).toHaveBeenCalledWith('ep-123');
    });
  });
});
