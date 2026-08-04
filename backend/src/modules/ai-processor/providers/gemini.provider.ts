import { Injectable, Logger } from '@nestjs/common';
import type {
  AiProvider,
  BriefingArticle,
  PodcastScript,
  ScriptSegment,
} from '../interfaces/ai-provider.interface';

interface GeminiResponse {
  choices: Array<{
    message: { content: string; role: string };
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
      'https://factchat-cloud.mindlogic.ai/v1/gateway/chat/completions/';
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
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Mindlogic API 오류: ${response.status} - ${errBody}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.choices?.[0]?.message?.content;
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
      .map((a, i) => `[Article ${i + 1}]\nTitle: ${a.title}\nSource: ${a.source ?? 'Unknown'}\nContent: ${a.content}\n`)
      .join('\n---\n');

    const prompt = `
You are the sole narrator and script writer for the IT podcast "Tech Insight".
Today's date: ${todayKst}

Delivery style: Single narrator delivering news in narration format.
Based on the news articles below, write a podcast script approximately 10 minutes long.

[Script Writing Rules]
1. Opening (approx. 1 min): Greeting + mention ${todayKst} + introduce today's topics
2. Main Briefing (2-3 min per news item): Deliver news → background explanation → significance analysis → smooth narration
3. Closing (approx. 1 min): Overall summary + preview of next episode
4. Pacing: Use commas (,), periods (.), and ellipses (...) actively for natural speech rhythm. Where a longer pause is needed at a topic transition or before emphasis, insert SSML tags like <break time="500ms"/> (or 300ms, 800ms) directly between sentences.

[Format - MUST follow exactly]
- Every line starts with "narrator: "
- When the news topic changes, insert "---TOPIC_CHANGE---" on its own line immediately before that line
- Pure spoken script (no emojis, special symbols, or markdown)
- No stage directions in parentheses: e.g., (pause), (music)
- Natural conversational tone

IMPORTANT: Write ALL output in Korean.

[Output Format]
TITLE: <briefing title in Korean>
SCRIPT:
narrator: 안녕하세요, 테크 인사이트입니다...
narrator: 오늘 첫 번째 소식은...

[News Data]
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
