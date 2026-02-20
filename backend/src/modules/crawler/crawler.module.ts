import { Module } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { RedisService } from './redis.service';

@Module({
  providers: [CrawlerService, RedisService],
  exports: [CrawlerService],
})
export class CrawlerModule {}
