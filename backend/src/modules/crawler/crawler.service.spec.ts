import { Test, TestingModule } from '@nestjs/testing';
import { CrawlerService } from './crawler.service';
import { RedisService } from './redis.service';

describe('CrawlerService', () => {
  let service: CrawlerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CrawlerService, { provide: RedisService, useValue: {} }],
    }).compile();

    service = module.get<CrawlerService>(CrawlerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
