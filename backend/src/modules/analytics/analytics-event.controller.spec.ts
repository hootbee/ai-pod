import { BadRequestException } from '@nestjs/common';
import { AnalyticsEventController } from './analytics-event.controller';
import { AnalyticsEventType } from './entities/analytics-event.entity';

describe('AnalyticsEventController', () => {
  it('서버 전용 인증 이벤트를 클라이언트가 직접 기록하지 못하게 한다', async () => {
    const eventService = { record: jest.fn() };
    const controller = new AnalyticsEventController(eventService as never);

    await expect(
      controller.recordEvent({ sub: 'user-1' } as never, {
        eventType: AnalyticsEventType.LOGIN_SUCCESS,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(eventService.record).not.toHaveBeenCalled();
  });

  it('콘텐츠 이벤트를 사용자 ID와 함께 저장한다', async () => {
    const eventService = {
      record: jest.fn().mockResolvedValue({
        id: 'event-1',
        eventType: AnalyticsEventType.EPISODE_PROGRESS,
        createdAt: new Date('2026-08-13T00:00:00.000Z'),
      }),
    };
    const controller = new AnalyticsEventController(eventService as never);

    const result = await controller.recordEvent({ sub: 'user-1' } as never, {
      eventType: AnalyticsEventType.EPISODE_PROGRESS,
      episodeId: 'episode-1',
    });

    expect(eventService.record).toHaveBeenCalledWith('user-1', {
      eventType: AnalyticsEventType.EPISODE_PROGRESS,
      episodeId: 'episode-1',
    });
    expect(result.id).toBe('event-1');
  });
});
