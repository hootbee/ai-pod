import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AnalyticsEventType } from '../entities/analytics-event.entity';

export class CreateAnalyticsEventDto {
  @IsEnum(AnalyticsEventType)
  eventType: AnalyticsEventType;

  @IsOptional()
  @IsUUID()
  episodeId?: string;

  @IsOptional()
  @IsUUID()
  cardNewsId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  sessionId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  source?: string;

  @IsOptional()
  @IsUUID()
  sourceEpisodeId?: string;

  @IsOptional()
  @IsUUID()
  destinationCardNewsId?: string;
}
