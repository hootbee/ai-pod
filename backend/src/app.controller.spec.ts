import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiProcessorService } from './modules/ai-processor/ai-processor.service';
import { CrawlerService } from './modules/crawler/crawler.service';
import { EpisodesService } from './modules/episodes/episodes.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: AiProcessorService, useValue: {} },
        { provide: CrawlerService, useValue: {} },
        { provide: EpisodesService, useValue: {} },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
