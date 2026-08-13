import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum AnalyticsEventType {
  SIGNUP_COMPLETE = 'signup_complete',
  EPISODE_START = 'episode_start',
  EPISODE_PROGRESS = 'episode_progress',
  EPISODE_COMPLETE = 'episode_complete',
  CARD_NEWS_OPEN = 'card_news_open',
  CARD_NEWS_COMPLETE = 'card_news_complete',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  REFRESH_SUCCESS = 'refresh_success',
  REFRESH_FAILED = 'refresh_failed',
  LOGOUT = 'logout',
}

@Entity({ name: 'analytics_events' })
@Index(['userId', 'createdAt'])
@Index(['eventType', 'createdAt'])
@Index(['episodeId', 'eventType'])
@Index(['cardNewsId', 'eventType'])
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 40 })
  eventType: AnalyticsEventType;

  @Column({ type: 'uuid', nullable: true })
  episodeId: string | null;

  @Column({ type: 'uuid', nullable: true })
  cardNewsId: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  sessionId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  source: string | null;

  @Column({ type: 'uuid', nullable: true })
  sourceEpisodeId: string | null;

  @Column({ type: 'uuid', nullable: true })
  destinationCardNewsId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
