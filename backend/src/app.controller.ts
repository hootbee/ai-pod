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

  @Get('privacy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getPrivacyPage(): string {
    return `
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AiPod 개인정보처리방침</title>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f6f8f2;
        color: #1f241a;
        line-height: 1.7;
      }
      main {
        padding: 40px 20px 80px;
      }
      .card {
        width: min(760px, 100%);
        margin: 0 auto;
        background: #fff;
        border: 1px solid #d8e0d0;
        border-radius: 20px;
        padding: 32px;
        box-shadow: 0 16px 40px rgba(47, 63, 31, 0.08);
      }
      h1, h2 {
        color: #1f241a;
      }
      h1 {
        margin-top: 0;
        font-size: 32px;
      }
      h2 {
        margin-top: 32px;
        font-size: 22px;
      }
      p, li {
        font-size: 16px;
      }
      ul {
        padding-left: 20px;
      }
      a {
        color: #6c7f2d;
        font-weight: 600;
        text-decoration: none;
      }
      .muted {
        color: #5c6654;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="card">
        <h1>AiPod 개인정보처리방침</h1>
        <p class="muted">최종 업데이트: 2026-07-11</p>

        <p>
          AiPod는 뉴스 기반 오디오 콘텐츠와 카드뉴스를 제공하기 위해 필요한 범위 내에서만
          사용자 정보를 처리합니다.
        </p>

        <h2>1. 수집하는 정보</h2>
        <ul>
          <li>로그인 시 제공되는 계정 식별 정보(예: 이메일, 이름)</li>
          <li>서비스 이용 과정에서 생성되는 이용 기록</li>
          <li>기기 및 앱 동작에 필요한 최소한의 기술 정보</li>
        </ul>

        <h2>2. 정보 이용 목적</h2>
        <ul>
          <li>회원 식별 및 로그인 기능 제공</li>
          <li>개인화된 콘텐츠 제공 및 서비스 운영</li>
          <li>오류 대응, 안정성 개선, 고객 문의 처리</li>
        </ul>

        <h2>3. 정보 보관 및 삭제</h2>
        <p>
          관련 법령 또는 서비스 운영상 필요한 기간 동안만 정보를 보관하며, 목적 달성 후에는
          지체 없이 삭제하거나 안전하게 보관합니다.
        </p>

        <h2>4. 제3자 제공</h2>
        <p>
          법령에 따른 경우를 제외하고, 이용자 동의 없이 개인정보를 외부에 제공하지 않습니다.
        </p>

        <h2>5. 문의처</h2>
        <p>
          개인정보 관련 문의는 아래 이메일로 접수할 수 있습니다.<br />
          <a href="mailto:hootbee0327@gmail.com">hootbee0327@gmail.com</a>
        </p>
      </section>
    </main>
  </body>
</html>`;
  }

  @Get('privacy-policy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getPrivacyPolicyAlias(): string {
    return this.getPrivacyPage();
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
