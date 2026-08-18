import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PipelineRunService } from './pipeline-run.service';
import { PipelineRun, PipelineRunStatus, PipelineRunType } from './entities/pipeline-run.entity';
import { PipelineRunStep, PipelineRunStepStatus } from './entities/pipeline-run-step.entity';

describe('PipelineRunService', () => {
  let service: PipelineRunService;
  const runRepository = {
    create: jest.fn((value) => value),
    save: jest.fn((value) => ({ id: 'run-1', ...value })),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const stepRepository = {
    create: jest.fn((value) => value),
    save: jest.fn((value) => ({ id: 'step-1', ...value })),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineRunService,
        { provide: getRepositoryToken(PipelineRun), useValue: runRepository },
        { provide: getRepositoryToken(PipelineRunStep), useValue: stepRepository },
      ],
    }).compile();

    service = module.get(PipelineRunService);
    jest.clearAllMocks();
  });

  it('실행 시작을 running 상태로 저장한다', async () => {
    const run = await service.startRun(PipelineRunType.DAILY, '2026-08-17');

    expect(runRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        runType: PipelineRunType.DAILY,
        businessDate: '2026-08-17',
        status: PipelineRunStatus.RUNNING,
      }),
    );
    expect(run.id).toBe('run-1');
  });

  it('단계 시작과 완료를 같은 실행 ID로 저장한다', async () => {
    const run = { id: 'run-1' } as PipelineRun;

    await service.startStep(run, 'thumbnail_generation');
    await service.completeStep(run, 'thumbnail_generation', { imagePath: '/thumbnails/a.png' });

    expect(stepRepository.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        pipelineRunId: 'run-1',
        step: 'thumbnail_generation',
        status: PipelineRunStepStatus.RUNNING,
      }),
    );
    expect(stepRepository.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        pipelineRunId: 'run-1',
        step: 'thumbnail_generation',
        status: PipelineRunStepStatus.COMPLETED,
        metadata: { imagePath: '/thumbnails/a.png' },
      }),
    );
  });

  it('경고가 있으면 completed_with_warnings로 종료한다', async () => {
    await service.finishRun({ id: 'run-1' } as PipelineRun, ['썸네일 생성 실패']);

    expect(runRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'run-1',
        status: PipelineRunStatus.COMPLETED_WITH_WARNINGS,
        warnings: ['썸네일 생성 실패'],
        completedAt: expect.any(Date),
      }),
    );
  });

  it('예외 메시지와 함께 실패 단계가 저장된다', async () => {
    await service.failStep(
      { id: 'run-1' } as PipelineRun,
      'card_news_generation',
      new Error('image search failed'),
    );

    expect(stepRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineRunId: 'run-1',
        step: 'card_news_generation',
        status: PipelineRunStepStatus.FAILED,
        errorMessage: 'Error: image search failed',
      }),
    );
  });

  it('실행별 단계 이력을 생성 시각 순서로 조회한다', async () => {
    stepRepository.find.mockResolvedValue([{ id: 'step-1' }]);

    await expect(service.findSteps('run-1')).resolves.toEqual([{ id: 'step-1' }]);
    expect(stepRepository.find).toHaveBeenCalledWith({
      where: { pipelineRunId: 'run-1' },
      order: { createdAt: 'ASC' },
    });
  });

  it('비동기 후속 실패를 완료 경고 상태로 갱신한다', async () => {
    runRepository.findOne.mockResolvedValue({
      id: 'run-1',
      status: PipelineRunStatus.COMPLETED,
      warnings: [],
      completedAt: new Date(),
    });

    await service.recordAsyncFailure('run-1', 'TTS 생성 실패', new Error('provider unavailable'));

    expect(runRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'run-1',
        status: PipelineRunStatus.COMPLETED_WITH_WARNINGS,
        warnings: ['TTS 생성 실패'],
        errorMessage: 'Error: provider unavailable',
      }),
    );
  });
});
