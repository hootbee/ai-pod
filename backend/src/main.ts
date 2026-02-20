import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CrawlerService } from './modules/crawler/crawler.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  if (process.env.CRAWLER_PREVIEW === '1') {
    const crawler = app.get(CrawlerService);
    const items = await crawler.fetchLatest(5);
    console.log('Crawler preview items:', items);

    for (const item of items) {
      try {
        const content = await crawler.fetchArticleContent(item.link);
        console.log(`\n[${item.source}] ${item.title}`);
        console.log(content.slice(0, 1200));
      } catch (error) {
        console.warn(`Failed to fetch content for ${item.link}`);
        console.warn(error);
      }
    }

    await app.close();
    return;
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
