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

  @Column({ type: 'jsonb' })
  imagePaths: string[]; // 슬라이드별 PNG 경로 배열 [표지, 주제..., 마무리]

  /** 'topics': 기존 주제별 1장, 'deep-dive': 1주제 4장 심층 */
  @Column({ type: 'varchar', length: 20, default: 'topics' })
  cardType: string;

  @Column({ type: 'int', default: 0 })
  slideCount: number;

  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @Column({ type: 'jsonb', nullable: true })
  scriptSnapshot: Record<string, unknown> | null; // Director 분석 결과 저장

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
