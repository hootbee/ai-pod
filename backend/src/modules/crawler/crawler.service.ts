import { Injectable } from '@nestjs/common';
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';

export type CrawlerItem = {
  sourceId: string;
  source: string;
  title: string;
  link: string;
  publishedAt?: string;
  summary?: string;
  categories?: string[];
  content?: string;
};

type FeedSource = {
  id: string;
  name: string;
  feedUrl: string;
  homepage?: string;
};

@Injectable()
export class CrawlerService {
  private readonly parser = new Parser({
    timeout: 10000,
    requestOptions: {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; aipod-crawler/1.0; +https://example.com)',
      },
    },
  });

  private readonly sources: FeedSource[] = [
    {
      id: 'techcrunch',
      name: 'TechCrunch',
      feedUrl: 'https://techcrunch.com/feed/',
      homepage: 'https://techcrunch.com',
    },
    {
      id: 'verge',
      name: 'The Verge',
      feedUrl: 'https://www.theverge.com/rss/index.xml',
      homepage: 'https://www.theverge.com',
    },
    {
      id: 'ars-technica',
      name: 'Ars Technica',
      feedUrl: 'https://feeds.arstechnica.com/arstechnica/technology-lab',
      homepage: 'https://arstechnica.com',
    },
    {
      id: 'wired',
      name: 'WIRED',
      feedUrl: 'https://www.wired.com/feed/rss',
      homepage: 'https://www.wired.com',
    },
  ];

  getSources(): FeedSource[] {
    return [...this.sources];
  }

  async fetchLatest(limitPerSource = 10): Promise<CrawlerItem[]> {
    const results = await Promise.all(
      this.sources.map((source) => this.fetchSource(source, limitPerSource)),
    );

    return results.flat().sort((a, b) => {
      const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bTime - aTime;
    });
  }

  async fetchSource(source: FeedSource, limit = 10): Promise<CrawlerItem[]> {
    const feed = await this.parser.parseURL(source.feedUrl);

    return (feed.items ?? [])
      .slice(0, limit)
      .map((item) => {
        const summary = this.extractText(
          item.contentSnippet || item.content || item.summary || '',
        );

        return {
          sourceId: source.id,
          source: source.name,
          title: item.title?.trim() ?? '',
          link: item.link ?? '',
          publishedAt: item.isoDate ?? item.pubDate,
          summary: summary || undefined,
          categories: item.categories?.filter(Boolean),
        };
      })
      .filter((item) => item.title && item.link);
  }

  async fetchArticleContent(url: string, sourceId?: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; aipod-crawler/1.0; +https://example.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch article: ${response.status} ${url}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const contentRoot = this.selectContentRoot($, sourceId);

    const paragraphs = contentRoot
      .find('p')
      .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
      .get()
      .filter((text) => text.length > 40);

    return paragraphs.join('\n\n').trim();
  }

  private selectContentRoot(
    $: cheerio.CheerioAPI,
    sourceId?: string,
  ): cheerio.Cheerio<any> {
    if (sourceId === 'verge') {
      const vergeArticle = $('[data-chorus-optimize-field="articleBody"]');
      if (vergeArticle.length) {
        return vergeArticle;
      }
    }

    const article = $('article');
    return article.length ? article : $('main');
  }

  private extractText(html: string): string {
    if (!html) {
      return '';
    }

    const $ = cheerio.load(html);
    const text = $.text().replace(/\s+/g, ' ').trim();
    return text;
  }
}
