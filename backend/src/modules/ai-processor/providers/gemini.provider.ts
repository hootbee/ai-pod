import { Injectable, Logger } from '@nestjs/common';
import type {
  AiProvider,
  BriefingArticle,
  PodcastScript,
  ScriptSegment,
} from '../interfaces/ai-provider.interface';

interface GeminiResponse {
  candidates: Array<{
    content: { parts: Array<{ text: string }>; role: string };
  }>;
}

@Injectable()
export class GeminiProvider implements AiProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.MINDLOGIC_API_KEY;
    if (!apiKey) throw new Error('MINDLOGIC_API_KEY is not set');

    this.apiKey = apiKey;
    this.baseUrl =
      process.env.MINDLOGIC_BASE_URL ??
      'https://factchat-cloud.mindlogic.ai/v1/api/google/models/generate-content';
    this.model = process.env.MINDLOGIC_MODEL ?? 'gemini-2.5-flash';
  }

  private async callApi(prompt: string): Promise<string> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Mindlogic API 오류: ${response.status} - ${errBody}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Mindlogic API 응답에 텍스트 없음');
    return text.trim();
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

    const text = await this.callApi(prompt);
    return this.parseResponse(text);
  }

  async generateBriefingScript(articles: BriefingArticle[]): Promise<PodcastScript> {
    if (articles.length === 0) {
      return { title: '테크 인사이트 모닝 브리핑', script: '오늘은 브리핑할 기사가 없습니다.' };
    }

    const todayKst = new Date().toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    });

    const articlesText = articles
      .map((a, i) => `[기사 ${i + 1}]\n제목: ${a.title}\n출처: ${a.source ?? 'Unknown'}\n내용: ${a.content}\n`)
      .join('\n---\n');

    const prompt = `
당신은 IT 팟캐스트 '테크 인사이트'의 단독 진행자 대본 작가입니다.
오늘 날짜: ${todayKst}

진행 방식: 단일 진행자가 혼자 뉴스를 전달하는 나레이션 형식
아래 뉴스 기사를 바탕으로 약 10분 분량의 팟캐스트 대본을 작성하세요.

[대본 작성 규칙]
1. 오프닝(약 1분): 인사 + ${todayKst} 날짜 언급 + 오늘 주제 소개
2. 메인 브리핑(각 뉴스당 2-3분): 뉴스 전달 → 배경 설명 → 의의 분석 → 자연스러운 나레이션
3. 클로징(약 1분): 총평 + 다음 에피소드 예고
4. 뜸 들이기: 자연스러운 말하기 호흡을 위해 쉼표(,), 마침표(.), 말줄임표(...)를 적극적으로 활용하세요. 특히 내용이 전환되거나 강조하기 전 긴 뜸이 필요한 곳에는 SSML 태그인 <break time="500ms"/> (또는 300ms, 800ms 등)를 문장 사이사이에 직접 삽입하세요.

[포맷 - 반드시 지켜야 함]
- 모든 줄은 "narrator: " 로 시작
- 뉴스 주제가 바뀔 때 반드시 해당 줄 바로 앞에 "---TOPIC_CHANGE---" 를 단독 줄로 삽입
- 순수 말하기 원고 (이모지, 특수기호, 마크다운 금지)
- 괄호 지문 금지: (잠시), (음악) 등
- 자연스러운 구어체로 작성

[출력 형식]
TITLE: <브리핑 제목>
SCRIPT:
narrator: 안녕하세요, 테크 인사이트입니다...
narrator: 오늘 첫 번째 소식은...

[뉴스 데이터]
${articlesText}
`.trim();

    const text = await this.callApi(prompt);
    return this.parseResponse(text);
  }

  private parseSegments(script: string): ScriptSegment[] {
    const lines = script.split('\n').map((l) => l.trim());
    const segments: ScriptSegment[] = [];
    let nextIsTopicChange = false;

    for (const line of lines) {
      if (line === '---TOPIC_CHANGE---') {
        nextIsTopicChange = true;
        continue;
      }
      if (!line.startsWith('narrator:')) continue;

      const text = line.replace(/^narrator:\s*/, '').trim();
      if (!text) continue;

      segments.push({
        speaker: 'speaker1', // 단일 화자
        text,
        isTopicChange: nextIsTopicChange || undefined,
      });
      nextIsTopicChange = false;
    }

    return segments;
  }

  private cleanScript(script: string): string {
    return script
      .replace(/[\(（][^\)）]{0,20}[\)）]/g, '')
      .replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}]/gu, '')
      .replace(/[★●◆◇▶▷■□※•·]/g, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private parseResponse(text: string): PodcastScript {
    const titleMatch = text.match(/^TITLE:\s*(.+)$/im);
    const scriptMatch = text.match(/^SCRIPT:\s*([\s\S]+)$/im);
    const rawScript = scriptMatch?.[1]?.trim() || text;
    const cleaned = this.cleanScript(rawScript);
    const segments = this.parseSegments(cleaned);

    return {
      title: titleMatch?.[1]?.trim() || 'Podcast Script',
      script: cleaned,
      segments: segments.length > 0 ? segments : undefined,
    };
  }
}
