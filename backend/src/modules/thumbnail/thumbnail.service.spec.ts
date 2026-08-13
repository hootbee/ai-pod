import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ThumbnailService } from './thumbnail.service';
import { EpisodeThumbnail } from '../episodes/entities/episode-thumbnail.entity';
import { PodcastEpisode } from '../episodes/entities/podcast-episode.entity';
import { ThumbnailPromptService } from './thumbnail-prompt.service';
import { ThumbnailGeneratorService } from './thumbnail-generator.service';

const thumbnailRepositoryMock = () => ({
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('ThumbnailService', () => {
  let service: ThumbnailService;
  let thumbnailRepository: ReturnType<typeof thumbnailRepositoryMock>;
  let episodeRepository: { findOne: jest.Mock };
  let promptService: { buildPrompt: jest.Mock };
  let generatorService: { generate: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThumbnailService,
        { provide: getRepositoryToken(EpisodeThumbnail), useFactory: thumbnailRepositoryMock },
        { provide: getRepositoryToken(PodcastEpisode), useValue: { findOne: jest.fn() } },
        { provide: ThumbnailPromptService, useValue: { buildPrompt: jest.fn() } },
        { provide: ThumbnailGeneratorService, useValue: { generate: jest.fn() } },
      ],
    }).compile();

    service = module.get(ThumbnailService);
    thumbnailRepository = module.get(getRepositoryToken(EpisodeThumbnail));
    episodeRepository = module.get(getRepositoryToken(PodcastEpisode));
    promptService = module.get(ThumbnailPromptService);
    generatorService = module.get(ThumbnailGeneratorService);
  });

  afterEach(() => {
    delete process.env.THUMBNAIL_OUTPUT_DIR;
    jest.clearAllMocks();
  });

  it('에피소드가 없으면 썸네일 생성을 중단한다', async () => {
    episodeRepository.findOne.mockResolvedValue(null);

    await expect(service.generateAndSave('missing')).rejects.toThrow(
      '에피소드를 찾을 수 없습니다: missing',
    );
    expect(promptService.buildPrompt).not.toHaveBeenCalled();
    expect(generatorService.generate).not.toHaveBeenCalled();
  });

  it('headline 또는 subtitle이 없으면 생성하지 않는다', async () => {
    episodeRepository.findOne.mockResolvedValue({
      id: 'episode-1',
      headline: '헤드라인',
      headlineSubtitle: null,
      createdAt: new Date('2026-08-13T00:00:00.000Z'),
    });

    await expect(service.generateAndSave('episode-1')).rejects.toThrow(
      '헤드라인 또는 부제가 없습니다',
    );
    expect(promptService.buildPrompt).not.toHaveBeenCalled();
  });

  it('프롬프트·이미지 생성 후 기존 episodeId 레코드를 upsert한다', async () => {
    process.env.THUMBNAIL_OUTPUT_DIR = '/tmp/aipod-thumbnail-test';
    episodeRepository.findOne.mockResolvedValue({
      id: 'episode-12345678',
      headline: '헤드라인',
      headlineSubtitle: '부제',
      createdAt: new Date('2026-08-13T00:00:00.000Z'),
    });
    promptService.buildPrompt.mockResolvedValue('generated prompt');
    generatorService.generate.mockResolvedValue(
      '/tmp/aipod-thumbnail-test/20260813-episode--thumbnail.png',
    );
    const queryBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orUpdate: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    thumbnailRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    thumbnailRepository.findOneOrFail.mockResolvedValue({
      id: 'thumbnail-1',
      episodeId: 'episode-12345678',
      imagePath: '/tmp/aipod-thumbnail-test/20260813-episode--thumbnail.png',
      prompt: 'generated prompt',
    });

    const result = await service.generateAndSave('episode-12345678');

    expect(promptService.buildPrompt).toHaveBeenCalledWith('헤드라인', '부제');
    expect(generatorService.generate).toHaveBeenCalledWith(
      'generated prompt',
      '/tmp/aipod-thumbnail-test/20260813-episode--thumbnail.png',
    );
    expect(queryBuilder.values).toHaveBeenCalledWith({
      episodeId: 'episode-12345678',
      imagePath: '/tmp/aipod-thumbnail-test/20260813-episode--thumbnail.png',
      prompt: 'generated prompt',
    });
    expect(queryBuilder.orUpdate).toHaveBeenCalledWith(['imagePath', 'prompt'], ['episodeId']);
    expect(result.imagePath).toBe('/thumbnails/20260813-episode--thumbnail.png');
  });

  it('썸네일 조회 결과의 파일 경로를 public 경로로 변환한다', async () => {
    thumbnailRepository.findOne.mockResolvedValue({
      id: 'thumbnail-1',
      episodeId: 'episode-1',
      imagePath: '/var/lib/aipod/thumbnails/episode.png',
    });

    const result = await service.findByEpisodeId('episode-1');

    expect(result).toEqual(expect.objectContaining({ imagePath: '/thumbnails/episode.png' }));
  });
});
