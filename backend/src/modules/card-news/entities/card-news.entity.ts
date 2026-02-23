import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PodcastEpisode } from '../../episodes/entities/podcast-episode.entity';

@Entity({ name: 'card_news' })
export class CardNews {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  episodeId: string;

  @ManyToOne(() => PodcastEpisode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'episodeId' })
  episode: PodcastEpisode;

  @Column({ type: 'varchar', length: 1024 })
  imagePath: string;

  @Column({ type: 'jsonb', nullable: true })
  designDirection: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
