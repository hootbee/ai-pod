import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AudioStatus = 'pending' | 'processing' | 'done' | 'failed';

export type EpisodeSource = {
  title: string;
  source: string;
  link: string;
};

@Entity({ name: 'podcast_episodes' })
export class PodcastEpisode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  script: string;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  audioPath: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  audioStatus: AudioStatus;

  @Column({ type: 'int', default: 0 })
  sourceCount: number;

  @Column({ type: 'int', default: 0 })
  audioPlayCount: number;

  /** 클릭베이트 헤드라인 제목 (예: "GPT-5 나온다는데 하루 안에 CEO가 도망?!") */
  @Column({ type: 'varchar', length: 255, nullable: true })
  headline: string | null;

  /** 헤드라인 부제 (예: "정말 도망치는 걸수도 있어요. 하지만 움직임을 확인해보세요.") */
  @Column({ type: 'text', nullable: true })
  headlineSubtitle: string | null;

  /** 원문 기사 출처 목록 (제목, 출처명, 링크) */
  @Column({ type: 'jsonb', nullable: true })
  sources: EpisodeSource[] | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
