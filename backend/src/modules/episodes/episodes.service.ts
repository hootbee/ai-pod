import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
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

  async resolveAudioFilePath(id: string, preferredExtHint?: string): Promise<string> {
    const episode = await this.findOneEntity(id);
    if (!episode.audioPath) {
      throw new NotFoundException(`Audio path not found for episode: ${id}`);
    }

    const raw = episode.audioPath.trim();
    const primaryAudioDirs = [
      path.resolve(process.env.AUDIO_OUTPUT_DIR ?? './audio-files'),
      path.resolve('./backend/audio-files'),
    ];
    const fallbackAudioDirs = [
      path.resolve(process.env.AUDIO_OUTPUT_FALLBACK_DIR ?? './audio-files_from_docker'),
      path.resolve('./backend/audio-files_from_docker'),
    ];
    const audioDirs = [...new Set([...primaryAudioDirs, ...fallbackAudioDirs])];

    const basename = path.basename(raw);
    const requestedExt = path.extname(basename).toLowerCase();
    const stem = requestedExt ? basename.slice(0, -requestedExt.length) : basename;
    const normalizedHint = preferredExtHint
      ? `.${preferredExtHint.replace(/^\./, '').toLowerCase()}`
      : '';
    const fallbackExts = [normalizedHint, requestedExt, '.m4a', '.mp3', '.wav', '.aac'].filter(Boolean);
    const orderedExts = [...new Set(fallbackExts)];

    const candidates = new Set<string>();

    // 1) extHint가 있으면 같은 stem의 힌트 확장자를 최우선으로 탐색
    if (normalizedHint && stem) {
      const hintedBasename = `${stem}${normalizedHint}`;
      for (const dir of audioDirs) {
        candidates.add(path.join(dir, hintedBasename));
      }
      const rawDir = path.dirname(path.resolve(raw));
      candidates.add(path.join(rawDir, hintedBasename));
    }

    // 2) 현재 값이 절대/상대 경로일 때 그대로
    candidates.add(path.resolve(raw));

    // 3) basename 기준으로 기본/폴백 오디오 디렉터리 탐색
    for (const dir of audioDirs) {
      candidates.add(path.join(dir, basename));
    }

    // 4) 확장자가 DB 값과 다를 때 같은 stem으로 다른 확장자 탐색
    for (const dir of audioDirs) {
      for (const ext of orderedExts) {
        if (!stem) continue;
        candidates.add(path.join(dir, `${stem}${ext}`));
      }
    }

    // 5) Docker 내부 경로(/app/audio-files/...)를 로컬 디렉터리로 재매핑
    if (raw.includes('/audio-files/')) {
      for (const dir of audioDirs) {
        candidates.add(path.join(dir, basename));
      }
    }

    const candidateList = [...candidates];
    const resolved = candidateList.find((candidate) => fs.existsSync(candidate));
    if (!resolved) {
      throw new NotFoundException(`Audio file not found. tried: ${candidateList.join(', ')}`);
    }

    return resolved;
  }
}
