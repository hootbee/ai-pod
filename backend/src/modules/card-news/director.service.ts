import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  DesignDirection,
  IDirectorService,
} from './interfaces/director.service.interface';

@Injectable()
export class DirectorService implements IDirectorService {
  private readonly logger = new Logger(DirectorService.name);
  private readonly model;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    const genAi = new GoogleGenerativeAI(apiKey);
    this.model = genAi.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  async analyze(script: string): Promise<DesignDirection> {
    const prompt = `
당신은 IT 테크 미디어의 수석 크리에이티브 디렉터입니다.
아래 팟캐스트 대본을 읽고, 카드뉴스 디자인 방향을 JSON으로만 답하세요.

[규칙]
- keyCopy: 청중의 시선을 사로잡는 임팩트 있는 한국어 헤드라인 (최대 20자)
- subCopy: 헤드라인을 보완하는 한 줄 설명 (최대 40자)
- keyPoints: 핵심 포인트 2~3개 (각 최대 30자)
- theme: 뉴스 분위기에 따라 'dark'(심각/혁신) 또는 'light'(밝음/긍정)
- accentColor: 테마에 어울리는 hex 색상 (예: '#4FC3F7', '#66BB6A', '#FF7043')
- mood: 'serious' | 'bright' | 'urgent'
- imageKeywords: Unsplash 이미지 검색용 짧은 영어 단어 1개 (예: ["technology"])

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 없이):
{
  "theme": "dark",
  "accentColor": "#4FC3F7",
  "keyCopy": "AI가 바꾸는 에너지의 미래",
  "subCopy": "빅테크의 전략적 선택, 지속가능성",
  "keyPoints": ["탄소 중립 2030 선언", "신재생 에너지 투자 급증", "핵에너지 재조명"],
  "mood": "serious",
  "imageKeywords": ["artificial intelligence", "energy"]
}

[팟캐스트 대본 (앞 1500자)]
${script.slice(0, 1500)}
`.trim();

    const result = await this.model.generateContent(prompt);
    const text = result.response.text().trim();

    try {
      const cleaned = text.replace(/```json?|```/g, '').trim();
      return JSON.parse(cleaned) as DesignDirection;
    } catch {
      this.logger.warn('Director 응답 파싱 실패, 기본값 사용');
      return {
        theme: 'dark',
        accentColor: '#4FC3F7',
        keyCopy: '오늘의 테크 브리핑',
        subCopy: '최신 IT 트렌드를 한눈에',
        keyPoints: ['AI 혁신', '빅테크 전략', '미래 기술'],
        mood: 'serious',
        imageKeywords: ['technology', 'innovation'],
      };
    }
  }
}
