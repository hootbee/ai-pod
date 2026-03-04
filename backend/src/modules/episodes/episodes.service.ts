import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateAudioPathDto } from './dto/update-audio-path.dto';
import { AudioStatus, PodcastEpisode } from './entities/podcast-episode.entity';

@Injectable()
export class EpisodesService {
  constructor(
    @InjectRepository(PodcastEpisode)
    private readonly episodesRepository: Repository<PodcastEpisode>,
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

  async findAll(): Promise<PodcastEpisode[]> {
    return this.episodesRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<PodcastEpisode> {
    const episode = await this.episodesRepository.findOne({ where: { id } });
    if (!episode) {
      throw new NotFoundException(`Episode not found: ${id}`);
    }
    return episode;
  }

  async updateAudioPath(
    id: string,
    updateAudioPathDto: UpdateAudioPathDto,
  ): Promise<PodcastEpisode> {
    const episode = await this.findOne(id);
    episode.audioPath = updateAudioPathDto.audioPath;
    return this.episodesRepository.save(episode);
  }

  async updateAudioStatus(
    id: string,
    status: AudioStatus,
  ): Promise<PodcastEpisode> {
    const episode = await this.findOne(id);
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
}
