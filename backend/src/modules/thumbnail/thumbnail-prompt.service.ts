import { Injectable, Logger } from '@nestjs/common';
import type { IThumbnailPromptService } from './interfaces/thumbnail-prompt.service.interface';

interface TextResponse {
  candidates: Array<{
    content: { parts: Array<{ text: string }>; role: string };
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
      'https://factchat-cloud.mindlogic.ai/v1/api/google/models/generate-content';
    this.modelName = process.env.MINDLOGIC_MODEL ?? 'gemini-2.5-flash';
  }

  async buildPrompt(headline: string, subtitle: string): Promise<string> {
    const systemPrompt = `
당신은 테크 팟캐스트 썸네일 이미지 프롬프트 전문가입니다.
아래 팟캐스트 헤드라인과 부제를 읽고, 이미지 생성 프롬프트의 빈칸을 채워주세요.

헤드라인: ${headline}
부제: ${subtitle}

아래 템플릿의 대괄호 [] 항목을 채워 완성된 프롬프트 문자열만 반환하세요 (설명 없이):

A vibrant, strictly NO TEXT podcast thumbnail for a tech news channel in a clean, stylized 3D render style. Soft, bright studio lighting. The central scene is [핵심 오브젝트: 헤드라인을 상징하는 물체/캐릭터, 영어]. It displays [상황 묘사: 역동적이고 흥미로운 장면, 영어]. Floating [상징적인 아이콘 2~3가지, 영어 쉼표 구분] are around it. Whimsical, puzzling, and curious atmosphere. Clean [메인 색상 2가지, 영어 ex: deep blue and electric yellow] color palette with high clarity. 8k resolution, detailed textures, Unreal Engine 5 render, sharp focus. Aspect ratio 1:1.
`.trim();

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Mindlogic 텍스트 API 오류: ${response.status} - ${err}`);
    }

    const data = (await response.json()) as TextResponse;
    const prompt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!prompt) throw new Error('프롬프트 생성 응답 없음');

    this.logger.log(`[Prompt] 생성 완료: ${prompt.slice(0, 80)}...`);
    return prompt;
  }
}
