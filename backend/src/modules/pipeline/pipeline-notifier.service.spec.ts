import { PipelineNotifier } from './pipeline-notifier.service';

describe('PipelineNotifier', () => {
  const notifier = new PipelineNotifier();

  const sentContent = () =>
    (JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string) as { content: string })
      .content;

  beforeEach(() => {
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.example/webhook';
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    delete process.env.DISCORD_WEBHOOK_URL;
  });

  it('웹훅 URL이 없으면 전송하지 않는다', async () => {
    delete process.env.DISCORD_WEBHOOK_URL;

    const result = await notifier.notifyPublishFailure({ step: 'script_generation' });

    expect(result).toEqual({ attempted: false, ok: true });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('TTS 실패는 에피소드, job, run과 함께 알린다', async () => {
    await notifier.notifyPublishFailure({
      step: 'tts_completion',
      error: new Error('Cloud TTS unavailable'),
      detail: 'TTS job: 7',
      episodeId: 'ep-1',
      runId: 'run-1',
      triggerType: 'scheduler',
    });

    const [title, ...details] = sentContent().split('\n');
    expect(title).toMatch(/^❌ \[.+\] AiPod 발행 실패: TTS 생성 실패 \(tts_completion\)$/);
    expect(details).toEqual([
      'TTS job: 7',
      '에피소드: ep-1',
      '오류: Error: Cloud TTS unavailable',
      'run: run-1 · trigger: scheduler',
    ]);
  });

  it('알 수 없는 단계와 단계 시작 전 실패도 구분해 표시한다', async () => {
    await notifier.notifyPublishFailure({ step: 'headline_generation', error: 'boom' });
    await notifier.notifyPublishFailure({ step: null, error: 'boom' });

    const contents = (global.fetch as jest.Mock).mock.calls.map(
      ([, init]: [string, { body: string }]) =>
        (JSON.parse(init.body) as { content: string }).content,
    );
    expect(contents[0]).toContain('알 수 없는 단계 실패 (headline_generation)');
    expect(contents[1]).toContain('알 수 없는 단계 실패 (before_first_step)');
  });

  it('긴 오류 메시지는 Discord 길이 제한 안으로 자른다', async () => {
    await notifier.notifyPublishFailure({ step: 'script_generation', error: 'x'.repeat(3000) });

    expect(sentContent().length).toBeLessThan(2000);
    expect(sentContent()).toContain('…');
  });
});
