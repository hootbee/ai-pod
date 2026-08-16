import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  it('퍼널 단계별 사용자 수와 전환율을 계산한다', async () => {
    const dataSource = {
      query: jest.fn().mockResolvedValue([
        {
          signup: '100',
          login: '80',
          episode: '60',
          card: '30',
          episode_complete: '20',
          card_complete: '10',
          revisit: '25',
          no_content: '15',
          login_only: '10',
          episode_without_card: '30',
          avg_seconds_to_first_episode: '120.5',
          median_seconds_to_first_episode: '90',
        },
      ]),
    };
    const service = new AnalyticsService(dataSource as never);

    const result = await service.funnel({ from: '2026-08-01', to: '2026-08-13' });

    expect(result.steps).toEqual([
      { name: 'signup', userCount: 100, conversionFromPrevious: 1, conversionFromSignup: 1 },
      { name: 'login', userCount: 80, conversionFromPrevious: 0.8, conversionFromSignup: 0.8 },
      {
        name: 'episodeStart',
        userCount: 60,
        conversionFromPrevious: 0.75,
        conversionFromSignup: 0.6,
      },
      {
        name: 'cardNewsOpen',
        userCount: 30,
        conversionFromPrevious: 0.5,
        conversionFromSignup: 0.3,
      },
      {
        name: 'episodeComplete',
        userCount: 20,
        conversionFromPrevious: 0.6667,
        conversionFromSignup: 0.2,
      },
      {
        name: 'cardNewsComplete',
        userCount: 10,
        conversionFromPrevious: 0.5,
        conversionFromSignup: 0.1,
      },
      { name: 'revisit', userCount: 25, conversionFromPrevious: 2.5, conversionFromSignup: 0.25 },
    ]);
    expect(result.metrics).toEqual({
      noContentUsers: 15,
      loginOnlyUsers: 10,
      episodeWithoutCardUsers: 30,
      averageSecondsToFirstEpisode: 120.5,
      medianSecondsToFirstEpisode: 90,
    });
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('WITH base AS'), [
      '2026-08-01',
      '2026-08-14T00:00:00.000Z',
    ]);
  });

  it('사용자 목록의 이메일을 마스킹하고 pagination을 반환한다', async () => {
    const dataSource = {
      query: jest
        .fn()
        .mockResolvedValueOnce([
          {
            userId: 'user-1',
            email: 'e***@gmail.com',
            episodeCount: 2,
            cardNewsCount: 1,
          },
        ])
        .mockResolvedValueOnce([{ count: '21' }]),
    };
    const service = new AnalyticsService(dataSource as never);

    const result = await service.users({ page: 2, limit: 10, sort: 'createdAt', order: 'asc' });

    expect(result).toEqual({
      data: [expect.objectContaining({ email: 'e***@gmail.com' })],
      page: 2,
      limit: 10,
      total: 21,
      period: { from: '1970-01-01T00:00:00.000Z', to: '2999-12-31T00:00:00.000Z' },
    });
    expect(dataSource.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('LIMIT $3 OFFSET $4'),
      ['1970-01-01T00:00:00.000Z', '2999-12-31T00:00:00.000Z', 10, 10],
    );
  });

  it('에피소드 분석 쿼리는 unique 사용자와 전체 play 이벤트를 모두 반환하도록 요청한다', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([]) };
    const service = new AnalyticsService(dataSource as never);

    await service.episodes({ from: '2026-08-01', to: '2026-08-13' });

    const sql = dataSource.query.mock.calls[0][0] as string;
    expect(sql).toContain('"uniqueUsers"');
    expect(sql).toContain('"totalPlayEvents"');
    expect(sql).toContain("'episode_start'");
  });
});
