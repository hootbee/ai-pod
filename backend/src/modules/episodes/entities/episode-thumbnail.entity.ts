import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 에피소드에 연결된 1:1 썸네일 저장 모델.
 * 썸네일 생성 기능이 이 모델을 사용하더라도 에피소드가 참조하는 미디어 모델은 episodes가 소유한다.
 */
@Entity({ name: 'episode_thumbnails' })
export class EpisodeThumbnail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  episodeId: string;

  @Column({ type: 'varchar', length: 1024 })
  imagePath: string;

  @Column({ type: 'text' })
  prompt: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
