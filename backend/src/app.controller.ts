import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { AiProcessorService } from './modules/ai-processor/ai-processor.service';

type AiTestRequest = {
  content?: string;
};

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly aiProcessorService: AiProcessorService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('ai/test')
  async testAi(@Body() body: AiTestRequest) {
    const content = body?.content?.trim();
    if (!content) {
      throw new BadRequestException('content is required');
    }

    return this.aiProcessorService.processNewsToPodcast(content);
  }
}
