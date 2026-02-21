import { Module } from '@nestjs/common';
import { AiProcessorService } from './ai-processor.service';
import { GeminiProvider } from './providers/gemini.provider';
import { AI_PROVIDER_TOKEN } from './ai-processor.tokens';

@Module({
  providers: [
    GeminiProvider,
    {
      provide: AI_PROVIDER_TOKEN,
      useFactory: (geminiProvider: GeminiProvider) => {
        const llmType = (process.env.LLM_TYPE || 'gemini').toLowerCase();
        if (llmType === 'gemini') {
          return geminiProvider;
        }
        throw new Error(`Unsupported LLM_TYPE: ${llmType}`);
      },
      inject: [GeminiProvider],
    },
    AiProcessorService,
  ],
  exports: [AiProcessorService],
})
export class AiProcessorModule {}
