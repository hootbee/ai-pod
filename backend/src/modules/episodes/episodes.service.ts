import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateAudioPathDto } from './dto/update-audio-path.dto';
import { AudioStatus, PodcastEpisode } from './entities/podcast-episode.entity';
import { EpisodeThumbnail } from '../thumbnail/entities/episode-thumbnail.entity';
import { toPublicMediaPath } from '../../common/media-path.util';

export type PodcastEpisodeWithMedia = PodcastEpisode & { thumbnailPath: string | null };

@Injectable()
export class EpisodesService {
  constructor(
    @InjectRepository(PodcastEpisode)
    private readonly episodesRepository: Repository<PodcastEpisode>,
    @InjectRepository(EpisodeThumbnail)
    private readonly thumbnailsRepository: Repository<EpisodeThumbnail>,
  ) {}

  async create(createEpisodeDto: CreateEpisodeDto): Promise<PodcastEpisode> {
    const episode = this.episodesRepository.create({
      title: createEpisodeDto.title,
      script: createEpisodeDto.script,
      audioPath: createEpisodeDto.audioPath ?? null,
      sourceCount: createEpisodeDto.sourceCount ?? 0,
    });

    return this.episodesRepository.save(episode);
  }

  async findAll(): Promise<PodcastEpisodeWithMedia[]> {
    const episodes = await this.episodesRepository.find({
      order: { createdAt: 'DESC' },
    });

    const episodeIds = episodes.map((episode) => episode.id);
    const thumbnails = episodeIds.length > 0
      ? await this.thumbnailsRepository.find({ where: { episodeId: In(episodeIds) } })
      : [];
    const thumbnailMap = new Map(thumbnails.map((thumbnail) => [thumbnail.episodeId, thumbnail]));

    return episodes.map((episode) => this.withMedia(episode, thumbnailMap.get(episode.id)?.imagePath));
  }

  async findOne(id: string): Promise<PodcastEpisodeWithMedia> {
    const episode = await this.findOneEntity(id);
    const thumbnail = await this.thumbnailsRepository.findOne({ where: { episodeId: id } });
    return this.withMedia(episode, thumbnail?.imagePath);
  }

  async updateAudioPath(
    id: string,
    updateAudioPathDto: UpdateAudioPathDto,
  ): Promise<PodcastEpisode> {
    const episode = await this.findOneEntity(id);
    episode.audioPath = updateAudioPathDto.audioPath;
    return this.episodesRepository.save(episode);
  }

  async updateAudioStatus(
    id: string,
    status: AudioStatus,
  ): Promise<PodcastEpisode> {
    const episode = await this.findOneEntity(id);
    episode.audioStatus = status;
    return this.episodesRepository.save(episode);
  }

  /** 오늘(KST 00:00 이후) 생성된 에피소드 조회 — 파이프라인 중복 체크용 */
  async findTodayEpisode(): Promise<PodcastEpisode | null> {
    // KST = UTC+9, 오늘 KST 00:00 → UTC 어제 15:00
    const nowMs = Date.now();
    const kstOffsetMs = 9 * 60 * 60 * 1000;
    const todayKstMidnight = new Date(
      Math.floor((nowMs + kstOffsetMs) / 86_400_000) * 86_400_000 - kstOffsetMs,
    );
    return this.episodesRepository.findOne({
      where: { createdAt: MoreThanOrEqual(todayKstMidnight) },
      order: { createdAt: 'DESC' },
    });
  }

  private withMedia(
    episode: PodcastEpisode,
    thumbnailPath: string | undefined,
  ): PodcastEpisodeWithMedia {
    const normalizedAudioPath = toPublicMediaPath(episode.audioPath, '/audio-files');
    const normalizedThumbnailPath = toPublicMediaPath(thumbnailPath, '/thumbnails');

    return {
      ...episode,
      audioPath: normalizedAudioPath,
      thumbnailPath: normalizedThumbnailPath,
    };
  }

  private async findOneEntity(id: string): Promise<PodcastEpisode> {
    const episode = await this.episodesRepository.findOne({ where: { id } });
    if (!episode) {
      throw new NotFoundException(`Episode not found: ${id}`);
    }
    return episode;
  }
}
