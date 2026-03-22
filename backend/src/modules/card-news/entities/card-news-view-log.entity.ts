import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'card_news_view_logs' })
@Unique(['userId', 'cardNewsId'])
export class CardNewsViewLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  cardNewsId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
