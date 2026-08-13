import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAnalyticsEventDto } from './dto/create-analytics-event.dto';
import { AnalyticsEvent, AnalyticsEventType } from './entities/analytics-event.entity';

@Injectable()
export class AnalyticsEventService {
  static readonly clientEventTypes = new Set<AnalyticsEventType>([
    AnalyticsEventType.EPISODE_START,
    AnalyticsEventType.EPISODE_PROGRESS,
    AnalyticsEventType.EPISODE_COMPLETE,
    AnalyticsEventType.CARD_NEWS_OPEN,
    AnalyticsEventType.CARD_NEWS_COMPLETE,
  ]);

  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly repository: Repository<AnalyticsEvent>,
  ) {}

  async record(userId: string | null, input: CreateAnalyticsEventDto): Promise<AnalyticsEvent> {
    const metadata = input.metadata ? this.sanitizeMetadata(input.metadata) : null;
    const completedAt = input.completedAt ? new Date(input.completedAt) : null;

    return this.repository.save(
      this.repository.create({
        userId,
        eventType: input.eventType,
        episodeId: input.episodeId ?? null,
        cardNewsId: input.cardNewsId ?? null,
        sessionId: input.sessionId ?? null,
        metadata,
        completedAt,
        source: input.source ?? null,
        sourceEpisodeId: input.sourceEpisodeId ?? null,
        destinationCardNewsId: input.destinationCardNewsId ?? null,
      }),
    );
  }

  async recordSafe(userId: string | null, input: CreateAnalyticsEventDto): Promise<void> {
    try {
      await this.record(userId, input);
    } catch {
      // Analytics must never make the user-facing operation fail.
    }
  }

  private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const allowedKeys = new Set([
      'progressSeconds',
      'durationSeconds',
      'progressPercent',
      'dwellSeconds',
      'source',
    ]);
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata).slice(0, 20)) {
      if (!allowedKeys.has(key)) continue;
      if (key === 'source') {
        if (typeof value === 'string') sanitized[key] = value.slice(0, 32);
        continue;
      }
      const numberValue = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(numberValue) && numberValue >= 0) {
        sanitized[key] = key === 'progressPercent' ? Math.min(numberValue, 100) : numberValue;
      }
    }
    return sanitized;
  }
}
