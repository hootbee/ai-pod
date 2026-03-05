import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PodcastEpisode } from './entities/podcast-episode.entity';

interface HeadlineResponse {
  candidates: Array<{
    content: { parts: Array<{ text: string }>; role: string };
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
      'https://factchat-cloud.mindlogic.ai/v1/api/google/models/generate-content';
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
당신은 자극적인 유튜브·SNS 썸네일 제목을 쓰는 전문 카피라이터입니다.
아래 팟캐스트 대본을 읽고, 가장 충격적이거나 흥미로운 토픽 하나를 골라
클릭베이트 스타일의 제목과 부제를 작성하세요.

[규칙]
- headline (제목): 최대 30자, 궁금증·놀라움을 유발하는 한국어 문장. 마치 뉴스 속보나 유튜브 썸네일처럼.
  예시) "핫도그 많이 먹기 금메달리스트 되는 법" / "GPT-5 나온다는데 CEO가 하루 만에 도망?!"
- subtitle (부제): 30~60자, 제목에 대한 호기심을 증폭시키되 결론은 말하지 않는 문장.
  예시) "핫도그를 많이 먹을 필요도 없어요. 어쩌면 아예 먹을 필요도. 하지만 많이 먹은 사람이 되는 법을 확인해보세요."

반드시 아래 JSON 형식으로만 응답 (마크다운 없이):
{"headline": "...", "subtitle": "..."}

[팟캐스트 대본 (앞 3000자)]
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
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Mindlogic API 오류: ${response.status} - ${err}`);
    }

    const data = (await response.json()) as HeadlineResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Mindlogic API 응답에 텍스트 없음');

    const cleaned = text.replace(/```json?|```/g, '').trim();
    return JSON.parse(cleaned) as HeadlineResult;
  }
}
