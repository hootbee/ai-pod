import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CrawlerModule } from './modules/crawler/crawler.module';
import { AiProcessorModule } from './modules/ai-processor/ai-processor.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CrawlerModule,
    AiProcessorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
