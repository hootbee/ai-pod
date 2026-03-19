import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import type { IRendererService } from './interfaces/renderer.service.interface';
import { CARD_NEWS_HEIGHT, CARD_NEWS_WIDTH } from './card-news.constants';

@Injectable()
export class RendererService implements IRendererService {
  private readonly logger = new Logger(RendererService.name);

  async renderToFile(html: string, outputPath: string): Promise<string> {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({
        width: CARD_NEWS_WIDTH,
        height: CARD_NEWS_HEIGHT,
        deviceScaleFactor: 2,
      });
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.screenshot({ path: outputPath as `${string}.png`, type: 'png', fullPage: false });
      this.logger.log(`카드뉴스 PNG 저장: ${outputPath}`);
      return outputPath;
    } finally {
      await browser.close();
    }
  }
}
