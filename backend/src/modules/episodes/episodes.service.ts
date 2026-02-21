import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateAudioPathDto } from './dto/update-audio-path.dto';
import { PodcastEpisode } from './entities/podcast-episode.entity';

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
}
