import { Injectable, Logger } from '@nestjs/common';
import type { IThumbnailPromptService } from './interfaces/thumbnail-prompt.service.interface';

interface TextResponse {
  choices: Array<{
    message: { content: string; role: string };
  }>;
}

/**
 * 책임: 헤드라인 + 부제 → 이미지 생성 프롬프트 텍스트 생성 (SRP)
 * LLM으로 템플릿의 [오브젝트], [상황], [아이콘], [색상] 채워넣기
 */
@Injectable()
export class ThumbnailPromptService implements IThumbnailPromptService {
  private readonly logger = new Logger(ThumbnailPromptService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly modelName: string;

  constructor() {
    const apiKey = process.env.MINDLOGIC_API_KEY;
    if (!apiKey) throw new Error('MINDLOGIC_API_KEY is not set');
    this.apiKey = apiKey;
    this.baseUrl =
      process.env.MINDLOGIC_BASE_URL ??
      'https://factchat-cloud.mindlogic.ai/v1/gateway/chat/completions/';
    this.modelName = process.env.MINDLOGIC_MODEL ?? 'gemini-2.5-flash';
  }

  async buildPrompt(headline: string, subtitle: string): Promise<string> {
    const systemPrompt = `
You are an expert at writing image generation prompts for tech podcast thumbnails.
Read the podcast headline and subtitle below, then fill in the bracketed placeholders in the image generation prompt template.

Headline: ${headline}
Subtitle: ${subtitle}

Fill in each [placeholder] in the template below and return ONLY the completed prompt string (no explanation):

A vibrant, strictly NO TEXT podcast thumbnail for a tech news channel in a clean, stylized 3D render style. Soft, bright studio lighting. The central scene is [main object: item/character symbolizing the headline, in English]. It displays [scene description: dynamic and engaging situation, in English]. Floating [2~3 symbolic icons related to the topic, comma-separated in English] are around it. Whimsical, puzzling, and curious atmosphere. Clean [2 main colors in English, e.g. deep blue and electric yellow] color palette with high clarity. 8k resolution, detailed textures, Unreal Engine 5 render, sharp focus. Aspect ratio 1:1.
`.trim();

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [{ role: 'user', content: systemPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Mindlogic 텍스트 API 오류: ${response.status} - ${err}`);
    }

    const data = (await response.json()) as TextResponse;
    const prompt = data.choices?.[0]?.message?.content?.trim();
    if (!prompt) throw new Error('프롬프트 생성 응답 없음');

    this.logger.log(`[Prompt] 생성 완료: ${prompt.slice(0, 80)}...`);
    return prompt;
  }
}
