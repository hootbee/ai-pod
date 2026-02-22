import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  AiProvider,
  BriefingArticle,
  PodcastScript,
} from '../interfaces/ai-provider.interface';

@Injectable()
export class GeminiProvider implements AiProvider {
  private readonly model;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const genAi = new GoogleGenerativeAI(apiKey);
    this.model = genAi.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  async generatePodcastScript(newsContent: string): Promise<PodcastScript> {
    const prompt = [
      'You are a news podcast script writer.',
      'Create a short podcast script in Korean for the following news.',
      'Return the result in this exact format:',
      'TITLE: <title>',
      'SCRIPT: <script>',
      '',
      newsContent,
    ].join('\n');

    const result = await this.model.generateContent(prompt);
    const text = result.response.text().trim();
    return this.parseResponse(text);
  }

  async generateBriefingScript(articles: BriefingArticle[]): Promise<PodcastScript> {
    if (articles.length === 0) {
      return {
        title: '테크 인사이트 모닝 브리핑',
        script: '오늘은 브리핑할 기사가 없습니다.',
      };
    }

    const articlesText = articles
      .map(
        (article, index) =>
          `[기사 ${index + 1}]\n제목: ${article.title}\n출처: ${article.source ?? 'Unknown'}\n내용: ${article.content}\n`,
      )
      .join('\n---\n');

    const prompt = `
당신은 출근길 직장인들을 위한 전문 IT 팟캐스트 '테크 인사이트'의 메인 호스트입니다.
아래 제공된 ${articles.length}개의 최신 IT 뉴스 기사들을 바탕으로, 약 10분 분량의 '모닝 뉴스 브리핑' 대본을 작성해 주세요.

[대본 작성 절대 규칙]
1. 오프닝(약 1분):
- 활기차고 전문적인 톤으로 인사하세요.
- 오늘 다룰 주요 뉴스 키워드 2~3개를 먼저 제시하세요.

2. 메인 브리핑(각 뉴스당 1.5~2분):
- 딱딱한 기사체가 아닌 청취자에게 말하듯 자연스러운 구어체를 사용하세요.
- 기사 사이마다 반드시 자연스러운 연결 멘트(브릿지)를 넣으세요.
- 기술 스펙 나열로 끝내지 말고, 마이크로소프트/아마존/엔비디아 등 빅테크 경쟁 구도나 시장 흐름에 미칠 파급력을 한 줄 인사이트로 덧붙이세요.

3. 클로징(약 1분):
- 오늘 뉴스들을 관통하는 총평을 남기고 다음 에피소드를 예고하며 마무리하세요.

4. 포맷 (매우 중요):
- 순수한 말하기 원고만 작성하세요. TTS가 그대로 읽을 텍스트입니다.
- 절대 금지: 괄호 안 지문 (예: (박수), (음악), (웃음)), 이모지, 특수기호 (★, ●, ※ 등), 마크다운 기호 (#, *, - 등)
- 절대 금지: 앞으로의 섹션 안내 제목 (예: [오프닝], [브리핑] 같은 대괄호 레이블)
- 반드시 아래 형식으로만 답변하세요:
TITLE: <브리핑 제목>
SCRIPT: <전체 대본>

[오늘의 뉴스 데이터]
${articlesText}
`.trim();

    const result = await this.model.generateContent(prompt);
    const text = result.response.text().trim();
    return this.parseResponse(text);
  }

  private cleanScript(script: string): string {
    return script
      // 괄호 지문 제거: (박수), (웃음), (음악), (효과음) 등
      .replace(/[\(（][^\)）]{0,20}[\)）]/g, '')
      // 대괄호 레이블 제거: [오프닝], [브리핑] 등
      .replace(/[\[\【][^\]\】]{0,20}[\]\】]/g, '')
      // 이모지 제거
      .replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      // 특수 기호 제거: ★ ● ◆ ※ ▶ 등
      .replace(/[★●◆◇▶▷■□※•·]/g, '')
      // 마크다운 기호 제거: #, **, -- 등
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
      // 연속 공백/줄바꿈 정리
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private parseResponse(text: string): PodcastScript {
    const titleMatch = text.match(/^TITLE:\s*(.+)$/im);
    const scriptMatch = text.match(/^SCRIPT:\s*([\s\S]+)$/im);

    const rawScript = scriptMatch?.[1]?.trim() || text;

    return {
      title: titleMatch?.[1]?.trim() || 'Podcast Script',
      script: this.cleanScript(rawScript),
    };
  }
}
