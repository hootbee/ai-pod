import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EpisodesService } from './episodes.service';
import { PodcastEpisode } from './entities/podcast-episode.entity';
import { EpisodeThumbnail } from './entities/episode-thumbnail.entity';
import { EpisodePlayLog } from './entities/episode-play-log.entity';
import { AnalyticsEventService } from '../analytics/analytics-event.service';
import { AnalyticsEventType } from '../analytics/entities/analytics-event.entity';

const repositoryMock = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  increment: jest.fn(),
  update: jest.fn(),
});

describe('EpisodesService', () => {
  let service: EpisodesService;
  let episodesRepository: ReturnType<typeof repositoryMock>;
  let thumbnailsRepository: ReturnType<typeof repositoryMock>;
  let playLogRepository: ReturnType<typeof repositoryMock>;
  let analyticsEventService: { recordSafe: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EpisodesService,
        { provide: getRepositoryToken(PodcastEpisode), useFactory: repositoryMock },
        { provide: getRepositoryToken(EpisodeThumbnail), useFactory: repositoryMock },
        { provide: getRepositoryToken(EpisodePlayLog), useFactory: repositoryMock },
        {
          provide: AnalyticsEventService,
          useValue: { recordSafe: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(EpisodesService);
    episodesRepository = module.get(getRepositoryToken(PodcastEpisode));
    thumbnailsRepository = module.get(getRepositoryToken(EpisodeThumbnail));
    playLogRepository = module.get(getRepositoryToken(EpisodePlayLog));
    analyticsEventService = module.get(AnalyticsEventService);
  });

  afterEach(() => jest.clearAllMocks());

  it('에피소드 생성 시 선택 필드 기본값을 채운다', async () => {
    const episode = { id: 'episode-1', title: '제목' } as PodcastEpisode;
    episodesRepository.create.mockReturnValue(episode);
    episodesRepository.save.mockResolvedValue(episode);

    const result = await service.create({ title: '제목', script: '본문' });

    expect(episodesRepository.create).toHaveBeenCalledWith({
      title: '제목',
      script: '본문',
      audioPath: null,
      sourceCount: 0,
      sources: null,
    });
    expect(result).toBe(episode);
  });

  it('에피소드 목록에 소유한 썸네일과 공개 미디어 경로를 매핑한다', async () => {
    const episode = {
      id: 'episode-1',
      title: '제목',
      audioPath: '/audio-files/episode.mp3',
      createdAt: new Date('2026-08-13T00:00:00.000Z'),
    } as PodcastEpisode;
    episodesRepository.findAndCount.mockResolvedValue([[episode], 1]);
    thumbnailsRepository.find.mockResolvedValue([
      { episodeId: 'episode-1', imagePath: '/thumbnails/episode.png' },
    ]);

    const result = await service.findAll({ limit: 10, offset: 0 });

    expect(result.totalCount).toBe(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'episode-1',
        audioPath: '/audio-files/episode.mp3',
        thumbnailPath: '/thumbnails/episode.png',
      }),
    );
    expect(thumbnailsRepository.find).toHaveBeenCalledWith({
      where: expect.objectContaining({ episodeId: expect.anything() }),
    });
  });

  it('첫 재생은 이벤트를 기록하고 play log와 재생 수를 생성한다', async () => {
    playLogRepository.findOne.mockResolvedValue(null);
    playLogRepository.create.mockImplementation((value) => value);
    playLogRepository.save.mockResolvedValue({ id: 'log-1' });

    const result = await service.incrementAudioPlayCount('episode-1', 'user-1');

    expect(analyticsEventService.recordSafe).toHaveBeenCalledWith('user-1', {
      eventType: AnalyticsEventType.EPISODE_START,
      episodeId: 'episode-1',
    });
    expect(playLogRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', episodeId: 'episode-1' }),
    );
    expect(episodesRepository.increment).toHaveBeenCalledWith(
      { id: 'episode-1' },
      'audioPlayCount',
      1,
    );
    expect(result).toEqual({ alreadyCounted: false });
  });

  it('중복 재생은 재생 수를 증가시키지 않고 마지막 재생 시각만 갱신한다', async () => {
    playLogRepository.findOne.mockResolvedValue({ id: 'log-1' });

    const result = await service.incrementAudioPlayCount('episode-1', 'user-1');

    expect(playLogRepository.update).toHaveBeenCalledWith(
      { id: 'log-1' },
      { lastPlayedAt: expect.any(Date) },
    );
    expect(playLogRepository.save).not.toHaveBeenCalled();
    expect(episodesRepository.increment).not.toHaveBeenCalled();
    expect(result).toEqual({ alreadyCounted: true });
  });

  it('존재하지 않는 에피소드 조회는 NotFoundException을 반환한다', async () => {
    episodesRepository.findOne.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow('Episode not found: missing');
  });
});
