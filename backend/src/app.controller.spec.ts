import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiProcessorService } from './modules/ai-processor/ai-processor.service';
import { CrawlerService } from './modules/crawler/crawler.service';
import { EpisodesService } from './modules/episodes/episodes.service';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { ROLES_KEY } from './modules/auth/decorators/roles.decorator';
import { UserRole } from './modules/users/entities/user.entity';

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

  describe('paid AI/pipeline endpoints', () => {
    it.each(['testAi', 'testBriefing', 'previewBriefingPipeline', 'runBriefingPipeline'] as const)(
      '%s requires admin JWT',
      (method) => {
        const handler = AppController.prototype[method];
        expect(Reflect.getMetadata('__guards__', handler)).toEqual([JwtAuthGuard, RolesGuard]);
        expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.ADMIN]);
      },
    );
  });
});
