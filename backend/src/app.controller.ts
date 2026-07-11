import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Post,
} from '@nestjs/common';
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

  @Get('contact')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getContactPage(): string {
    return `
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AiPod 연락처</title>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f6f8f2;
        color: #1f241a;
      }
      main {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .card {
        width: min(560px, 100%);
        background: #fff;
        border: 1px solid #d8e0d0;
        border-radius: 20px;
        padding: 32px;
        box-shadow: 0 16px 40px rgba(47, 63, 31, 0.08);
        text-align: center;
      }
      h1 {
        margin: 0 0 16px;
        font-size: 28px;
      }
      a {
        color: #6c7f2d;
        font-size: 18px;
        font-weight: 600;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="card">
        <h1>AiPod 연락처</h1>
        <a href="mailto:hootbee0327@gmail.com">hootbee0327@gmail.com</a>
      </section>
    </main>
  </body>
</html>`;
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
    const limitPerSource = Math.max(1, Math.min(10, Number(body?.limitPerSource ?? 5)));
    const maxArticles = Math.max(1, Math.min(20, Number(body?.maxArticles ?? 10)));

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
          content: content.slice(0, 1500),
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
