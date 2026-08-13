import { AnalyticsEventService } from './analytics-event.service';
import { AnalyticsEventType } from './entities/analytics-event.entity';

describe('AnalyticsEventService', () => {
  it('허용된 metadata만 저장한다', async () => {
    const repository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve({ id: 'event-1', ...value })),
    };
    const service = new AnalyticsEventService(repository as never);

    await service.record('user-1', {
      eventType: AnalyticsEventType.EPISODE_PROGRESS,
      metadata: {
        progressSeconds: '10',
        durationSeconds: 100,
        progressPercent: 120,
        password: 'must-not-be-stored',
      },
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { progressSeconds: 10, durationSeconds: 100, progressPercent: 100 },
      }),
    );
  });

  it('분석 저장 실패가 사용자 요청으로 전파되지 않는다', async () => {
    const service = new AnalyticsEventService({
      create: jest.fn(),
      save: jest.fn().mockRejectedValue(new Error('db unavailable')),
    } as never);

    await expect(
      service.recordSafe('user-1', {
        eventType: AnalyticsEventType.EPISODE_START,
      }),
    ).resolves.toBeUndefined();
  });
});
