import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  CardNewsScript,
  IDirectorService,
} from './interfaces/director.service.interface';

@Injectable()
export class DirectorService implements IDirectorService {
  private readonly logger = new Logger(DirectorService.name);
  private readonly model;

  constructor() {
    const apiKey = process.env.MINDLOGIC_API_KEY;
    if (!apiKey) throw new Error('MINDLOGIC_API_KEY is not set');
    const genAi = new GoogleGenerativeAI(apiKey);
    this.model = genAi.getGenerativeModel({ model: 'gemini-3-flash-preview' });
  }

  async analyze(script: string): Promise<CardNewsScript> {
    const today = new Date().toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const prompt = `
당신은 IT 테크 미디어의 수석 크리에이티브 디렉터입니다.
아래 팟캐스트 대본을 읽고, 멀티 슬라이드 카드뉴스 구성을 JSON으로만 답하세요.
오늘 날짜: ${today}

[슬라이드 구성 규칙]
1. 첫 번째 슬라이드 (type: "cover")
   - title: "오늘의 테크 브리핑" 또는 주제를 아우르는 한국어 헤드라인 (최대 20자)
   - body: "${today} · 주요 테크 뉴스 N가지" 형식
   - imageKeyword: 전체 주제를 대표하는 영어 단어 1개 (예: "technology")

2. 중간 슬라이드들 (type: "topic") - 대본의 가장 핵심 주제 1개만
   - title: 해당 뉴스의 핵심 헤드라인 (최대 20자)
   - body: 아래 3줄 구조로 작성, 총 공백 포함 100~150자
     · 첫 줄: 해당 주제의 가장 중요한 팩트 (1문장)
     · 중간 줄: 수치나 구체적인 근거 (신뢰도 향상, 1문장)
     · 마지막 줄: 시사점 또는 결론 (1문장)
     예시: "오픈AI가 차세대 AI 모델 GPT-5 개발을 공식 확인했습니다.\n학습 비용만 1조 원 이상이 투입될 예정입니다.\nAI 패권 경쟁이 새로운 국면에 접어들었습니다."
   - imageKeyword: Unsplash에서 반드시 검색되는 보편적인 영어 단어 1개
     (구체적인 복합어 금지! 예: "gaming ai" ❌ → "gaming" ✅, "nuclear energy" ❌ → "nuclear" ✅)
   - hashtags: 주제 관련 한국어 해시태그 2~3개 (예: ["#에너지", "#지속가능성", "#원자력"])

3. 마지막 슬라이드 (type: "closing")
   - title: "더 자세히 들어보세요" 고정
   - body: "오늘의 테크 브리핑 전체 내용은 AiPod 팟캐스트에서 확인하세요."
   - imageKeyword: "podcast"

[공통 규칙]
- theme: 전반적 분위기에 따라 'dark' 또는 'light'
- mood: 'serious' | 'bright' | 'urgent'
- 각 슬라이드의 accentColor: 슬라이드마다 어울리는 hex 색상 (표지는 브랜드색, 주제마다 다른 색)

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 없이):
{
  "theme": "dark",
  "mood": "serious",
  "slides": [
    {
      "type": "cover",
      "title": "오늘의 테크 브리핑",
      "body": "${today} · 주요 테크 뉴스 3가지",
      "imageKeyword": "technology",
      "accentColor": "#4FC3F7"
    },
    {
      "type": "topic",
      "title": "AI가 바꾸는 에너지",
      "body": "빅테크 기업들이 AI 데이터센터 전력 문제 해결을 위해 핵에너지에 주목하고 있습니다.",
      "imageKeyword": "nuclear",
      "accentColor": "#FF7043"
    },
    {
      "type": "closing",
      "title": "더 자세히 들어보세요",
      "body": "오늘의 테크 브리핑 전체 내용은 AiPod 팟캐스트에서 확인하세요.",
      "imageKeyword": "podcast",
      "accentColor": "#66BB6A"
    }
  ]
}

[팟캐스트 대본 (앞 2000자)]
${script.slice(0, 2000)}
`.trim();

    const result = await this.model.generateContent(prompt);
    const text = result.response.text().trim();

    try {
      const cleaned = text.replace(/```json?|```/g, '').trim();
      return JSON.parse(cleaned) as CardNewsScript;
    } catch {
      this.logger.warn('Director 응답 파싱 실패, 기본값 사용');
      return {
        theme: 'dark',
        mood: 'serious',
        slides: [
          { type: 'cover', title: '오늘의 테크 브리핑', body: `${today} · 최신 IT 뉴스`, imageKeyword: 'technology', accentColor: '#4FC3F7' },
          { type: 'topic', title: 'AI 혁신', body: '최신 AI 기술이 산업을 바꾸고 있습니다.', imageKeyword: 'artificial intelligence', accentColor: '#FF7043' },
          { type: 'closing', title: '더 자세히 들어보세요', body: '오늘의 테크 브리핑 전체 내용은 AiPod 팟캐스트에서 확인하세요.', imageKeyword: 'podcast', accentColor: '#66BB6A' },
        ],
      };
    }
  }
}
