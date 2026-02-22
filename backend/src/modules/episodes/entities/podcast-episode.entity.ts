import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AudioStatus = 'pending' | 'processing' | 'done' | 'failed';

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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
