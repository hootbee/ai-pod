import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'episode_play_logs' })
@Unique(['userId', 'episodeId'])
export class EpisodePlayLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  episodeId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
