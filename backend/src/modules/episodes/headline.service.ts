import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PodcastEpisode } from './entities/podcast-episode.entity';

interface HeadlineResponse {
  choices: Array<{
    message: { content: string; role: string };
  }>;
}

interface HeadlineResult {
  headline: string;
  subtitle: string;
}

@Injectable()
export class HeadlineService {
  private readonly logger = new Logger(HeadlineService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly modelName: string;

  constructor(
    @InjectRepository(PodcastEpisode)
    private readonly episodesRepository: Repository<PodcastEpisode>,
  ) {
    const apiKey = process.env.MINDLOGIC_API_KEY;
    if (!apiKey) throw new Error('MINDLOGIC_API_KEY is not set');
    this.apiKey = apiKey;
    this.baseUrl =
      process.env.MINDLOGIC_BASE_URL ??
      'https://factchat-cloud.mindlogic.ai/v1/gateway/chat/completions/';
    this.modelName = process.env.MINDLOGIC_MODEL ?? 'gemini-2.5-flash';
  }

  /**
   * 에피소드 스크립트에서 가장 충격적인 토픽을 골라
   * 클릭베이트 헤드라인 제목 + 부제 생성 후 DB 저장
   */
  async generateAndSave(episodeId: string): Promise<PodcastEpisode> {
    const episode = await this.episodesRepository.findOneOrFail({
      where: { id: episodeId },
    });

    this.logger.log(`[Headline] 생성 시작: episodeId=${episodeId}`);
    const result = await this.callLlm(episode.script);

    episode.headline = result.headline;
    episode.headlineSubtitle = result.subtitle;
    const saved = await this.episodesRepository.save(episode);
    this.logger.log(`[Headline] 저장 완료: "${result.headline}"`);
    return saved;
  }

  private async callLlm(script: string): Promise<HeadlineResult> {
    const prompt = `
You are a professional copywriter specializing in provocative YouTube and SNS thumbnail titles.
Read the podcast script below, choose the single most shocking or interesting topic,
and write a clickbait-style title and subtitle.

[Rules]
- headline: Max 30 Korean characters. A sentence that provokes curiosity or surprise — like a breaking news headline or YouTube thumbnail.
  Examples) "핫도그 많이 먹기 금메달리스트 되는 법" / "GPT-5 나온다는데 CEO가 하루 만에 도망?!"
- subtitle: 30~60 Korean characters. Amplifies curiosity about the title without revealing the conclusion.
  Examples) "핫도그를 많이 먹을 필요도 없어요. 어쩌면 아예 먹을 필요도. 하지만 많이 먹은 사람이 되는 법을 확인해보세요."

IMPORTANT: Write ALL text values in Korean.
Respond ONLY in the following JSON format (no markdown):
{"headline": "...", "subtitle": "..."}

[Podcast Script (first 3000 chars)]
${script.slice(0, 3000)}
`.trim();

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Mindlogic API 오류: ${response.status} - ${err}`);
    }

    const data = (await response.json()) as HeadlineResponse;
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Mindlogic API 응답에 텍스트 없음');

    const cleaned = text.replace(/```json?|```/g, '').trim();
    return JSON.parse(cleaned) as HeadlineResult;
  }
}
