import { Injectable, Logger } from '@nestjs/common';
import type { BriefingArticle } from '../ai-processor/interfaces/ai-provider.interface';

interface GroundingChunk {
  web?: { uri: string; title: string };
}

interface GroundingCandidate {
  content: { parts: Array<{ text: string }>; role: string };
  groundingMetadata?: {
    groundingChunks?: GroundingChunk[];
    webSearchQueries?: string[];
  };
}

interface GroundingResponse {
  candidates: GroundingCandidate[];
}

export interface GroundingResult {
  articles: BriefingArticle[];
  sources: Array<{ title: string; source: string; link: string }>;
}

@Injectable()
export class GroundingService {
  private readonly logger = new Logger(GroundingService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor() {
    const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_AI_STUDIO_API_KEY is not set');

    this.apiKey = apiKey;
    this.model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
  }

  async fetchLatestTechArticles(): Promise<GroundingResult> {
    const dateKst = new Date().toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const prompt = `오늘(${dateKst}) 기준 최신 IT/테크 뉴스를 Google 검색으로 찾아서 가장 중요한 기사 5~7개를 선별해줘.

선별 기준:
- 발행일: 오늘 또는 어제 (${dateKst})
- 선호 출처: TechCrunch, The Verge, Ars Technica, WIRED, VentureBeat, MIT Technology Review
- 주제: AI, 반도체, 빅테크, 스타트업 펀딩, 사이버보안

각 기사를 아래 형식으로 정확히 출력해줘. 형식 외 다른 텍스트 없이:

ARTICLE_START
TITLE: <기사 제목 (원문 그대로)>
SOURCE: <출처 사이트명>
LINK: <기사 URL>
SUMMARY: <핵심 내용 요약 3~5문장 (한국어)>
ARTICLE_END`;

    const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tools: [{ google_search: {} }],
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini Grounding API 오류: ${response.status} - ${errBody}`);
    }

    const data = (await response.json()) as GroundingResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini Grounding 응답에 텍스트 없음');

    const groundingChunks = data.candidates[0].groundingMetadata?.groundingChunks ?? [];
    this.logger.log(
      `[Grounding] 검색 완료 — 청크 ${groundingChunks.length}개, 텍스트 ${text.length}자`,
    );

    return this.parseArticles(text, groundingChunks);
  }

  private parseArticles(text: string, chunks: GroundingChunk[]): GroundingResult {
    const articles: BriefingArticle[] = [];
    const sources: Array<{ title: string; source: string; link: string }> = [];

    // groundingChunks에서 URL 맵 구성 (title → uri)
    const chunkUriMap = new Map<string, string>();
    for (const chunk of chunks) {
      if (chunk.web?.title && chunk.web.uri) {
        chunkUriMap.set(chunk.web.title.toLowerCase(), chunk.web.uri);
      }
    }

    const blocks = text.split('ARTICLE_START').slice(1);
    for (const block of blocks) {
      const end = block.indexOf('ARTICLE_END');
      const content = end !== -1 ? block.slice(0, end) : block;

      const title = this.extractField(content, 'TITLE');
      const source = this.extractField(content, 'SOURCE');
      const link = this.extractField(content, 'LINK') || this.findUriFromChunks(title, chunkUriMap);
      const summary = this.extractField(content, 'SUMMARY');

      if (!title || !summary) continue;

      articles.push({ title, content: summary, source: source || undefined });
      sources.push({ title, source: source || 'Unknown', link: link || '' });
    }

    this.logger.log(`[Grounding] 파싱 완료 — 기사 ${articles.length}건`);
    return { articles, sources };
  }

  private extractField(block: string, field: string): string {
    // FIELD: 다음 줄까지 멀티라인 포함 추출 (다음 FIELD 전까지)
    const regex = new RegExp(`${field}:\\s*([\\s\\S]*?)(?=\\n[A-Z]+:|$)`, 'i');
    return block.match(regex)?.[1]?.trim() ?? '';
  }

  private findUriFromChunks(title: string, map: Map<string, string>): string {
    if (!title) return '';
    const lower = title.toLowerCase();
    for (const [key, uri] of map) {
      if (key.includes(lower.slice(0, 20)) || lower.includes(key.slice(0, 20))) {
        return uri;
      }
    }
    return '';
  }
}
