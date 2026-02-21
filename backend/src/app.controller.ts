import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { AiProcessorService } from './modules/ai-processor/ai-processor.service';
import { CrawlerService } from './modules/crawler/crawler.service';
import type { BriefingArticle } from './modules/ai-processor/interfaces/ai-provider.interface';
import { EpisodesService } from './modules/episodes/episodes.service';

type AiTestRequest = {
  content?: string;
};

type BriefingTestRequest = {
  articles?: BriefingArticle[];
};

type PipelinePreviewRequest = {
  limitPerSource?: number;
  maxArticles?: number;
};

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly aiProcessorService: AiProcessorService,
    private readonly crawlerService: CrawlerService,
    private readonly episodesService: EpisodesService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('ai/test')
  async testAi(@Body() body: AiTestRequest) {
    const content = body?.content?.trim();
    if (!content) {
      throw new BadRequestException('content is required');
    }

    return this.aiProcessorService.processNewsToPodcast(content);
  }

  @Post('ai/briefing/test')
  async testBriefing(@Body() body: BriefingTestRequest) {
    const articles = (body?.articles ?? [])
      .map((article) => ({
        ...article,
        title: article.title?.trim(),
        content: article.content?.trim(),
      }))
      .filter((article) => article.title && article.content);

    if (articles.length === 0) {
      throw new BadRequestException('articles with title/content are required');
    }

    return this.aiProcessorService.processNewsBriefing(articles);
  }

  @Post('pipeline/briefing/preview')
  async previewBriefingPipeline(@Body() body: PipelinePreviewRequest) {
    const { articles } = await this.collectBriefingArticles(body);

    if (articles.length === 0) {
      throw new BadRequestException('No article content collected from crawler');
    }

    const briefing = await this.aiProcessorService.processNewsBriefing(articles);
    return {
      articleCount: articles.length,
      briefing,
    };
  }

  @Post('pipeline/briefing/run')
  async runBriefingPipeline(@Body() body: PipelinePreviewRequest) {
    const { articles } = await this.collectBriefingArticles(body);

    if (articles.length === 0) {
      throw new BadRequestException('No article content collected from crawler');
    }

    const briefing = await this.aiProcessorService.processNewsBriefing(articles);
    const episode = await this.episodesService.create({
      title: briefing.title,
      script: briefing.script,
      sourceCount: articles.length,
    });

    return {
      articleCount: articles.length,
      episode,
    };
  }

  private async collectBriefingArticles(body: PipelinePreviewRequest) {
    const limitPerSource = Math.max(1, Math.min(10, Number(body?.limitPerSource ?? 3)));
    const maxArticles = Math.max(1, Math.min(10, Number(body?.maxArticles ?? 7)));

    const items = await this.crawlerService.fetchLatest(limitPerSource);
    const candidates = items.slice(0, maxArticles);

    const articles: BriefingArticle[] = [];
    for (const item of candidates) {
      try {
        const content = await this.crawlerService.fetchArticleContent(item.link, item.sourceId);
        if (!content) {
          continue;
        }
        articles.push({
          title: item.title,
          content,
          source: item.source,
        });
        await this.crawlerService.markProcessed(item);
      } catch {
        // Skip unreadable article links and continue pipeline.
      }
    }

    return { articles };
  }
}
