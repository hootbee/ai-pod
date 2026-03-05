import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * 팟캐스트 에피소드 1:1 썸네일
 * - episodeId에 UNIQUE 제약 (에피소드당 한 장)
 * - 재생성 시 기존 레코드 upsert
 */
@Entity({ name: 'episode_thumbnails' })
export class EpisodeThumbnail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  episodeId: string;

  /** 로컬 저장 경로 (절대 경로 또는 THUMBNAIL_OUTPUT_DIR 하위 상대경로) */
  @Column({ type: 'varchar', length: 1024 })
  imagePath: string;

  /** 이미지 생성에 사용된 최종 프롬프트 */
  @Column({ type: 'text' })
  prompt: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
