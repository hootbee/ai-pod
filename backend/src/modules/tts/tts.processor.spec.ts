import { TtsProcessor } from './tts.processor';

describe('TtsProcessor', () => {
  const ttsService = {
    generateAudio: jest.fn(),
    testGenerate: jest.fn(),
  };
  const pipelineRunService = {
    startStep: jest.fn(),
    completeStep: jest.fn(),
    failStep: jest.fn(),
    recordAsyncFailure: jest.fn(),
  };
  const job = {
    id: 'job-1',
    data: { episodeId: 'episode-1', pipelineRunId: 'run-1' },
    progress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    ttsService.generateAudio.mockResolvedValue({ audioPath: '/audio-files/a.mp3' });
  });

  it('TTS 성공 시 완료 단계를 기록한다', async () => {
    const processor = new TtsProcessor(ttsService as never, pipelineRunService as never);

    await processor.handleGenerate(job as never);

    expect(pipelineRunService.startStep).toHaveBeenCalledWith({ id: 'run-1' }, 'tts_completion', {
      jobId: 'job-1',
    });
    expect(pipelineRunService.completeStep).toHaveBeenCalledWith(
      { id: 'run-1' },
      'tts_completion',
      { audioPath: '/audio-files/a.mp3', jobId: 'job-1' },
    );
  });

  it('TTS 실패 시 단계와 파이프라인 경고를 모두 기록한다', async () => {
    const error = new Error('Cloud TTS unavailable');
    ttsService.generateAudio.mockRejectedValue(error);
    const processor = new TtsProcessor(ttsService as never, pipelineRunService as never);

    await expect(processor.handleGenerate(job as never)).rejects.toThrow('Cloud TTS unavailable');

    expect(pipelineRunService.failStep).toHaveBeenCalledWith(
      { id: 'run-1' },
      'tts_completion',
      error,
      { jobId: 'job-1' },
    );
    expect(pipelineRunService.recordAsyncFailure).toHaveBeenCalledWith(
      'run-1',
      'TTS 생성 실패: Cloud TTS unavailable',
      error,
    );
  });
});
