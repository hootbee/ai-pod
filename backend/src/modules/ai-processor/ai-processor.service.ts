import { Inject, Injectable } from '@nestjs/common';
import { AI_PROVIDER_TOKEN } from './ai-processor.tokens';
import type {
  AiProvider,
  BriefingArticle,
  PodcastScript,
} from './interfaces/ai-provider.interface';

@Injectable()
export class AiProcessorService {
  constructor(@Inject(AI_PROVIDER_TOKEN) private readonly aiProvider: AiProvider) {}

  async processNewsToPodcast(newsContent: string): Promise<PodcastScript> {
    return this.aiProvider.generatePodcastScript(newsContent);
  }

  async processNewsBriefing(articles: BriefingArticle[]): Promise<PodcastScript> {
    return this.aiProvider.generateBriefingScript(articles);
  }
}
