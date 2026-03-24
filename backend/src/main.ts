import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as compression from 'compression';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { CrawlerService } from './modules/crawler/crawler.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Gzip/Brotli 압축 — threshold 1KB 이상 응답만 압축 (텍스트 트래픽 절감)
  app.use(compression({ level: 6, threshold: 1024 }));

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const mediaDirs = [
    { prefix: '/audio-files', dir: path.resolve(process.env.AUDIO_OUTPUT_DIR ?? './audio-files') },
    { prefix: '/thumbnails', dir: path.resolve(process.env.THUMBNAIL_OUTPUT_DIR ?? './thumbnails') },
    {
      prefix: '/card-news-images',
      dir: path.resolve(process.env.CARD_NEWS_OUTPUT_DIR ?? './card-news-images'),
    },
  ];

  for (const media of mediaDirs) {
    fs.mkdirSync(media.dir, { recursive: true });
    app.useStaticAssets(media.dir, { prefix: media.prefix });
  }

  if (process.env.CRAWLER_PREVIEW === '1') {
    const crawler = app.get(CrawlerService);
    const items = await crawler.fetchLatest(5);
    console.log('Crawler preview items:', items);

    for (const item of items) {
      try {
        const content = await crawler.fetchArticleContent(item.link, item.sourceId);
        console.log(`\n[${item.source}] ${item.title}`);
        console.log(content.slice(0, 1200));
        await crawler.markProcessed(item);
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
