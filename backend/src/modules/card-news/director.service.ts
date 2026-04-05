import { Injectable, Logger } from '@nestjs/common';
import type {
  CardNewsScript,
  DeepDiveScript,
  IDirectorService,
} from './interfaces/director.service.interface';

interface GeminiResponse {
  candidates: Array<{
    content: { parts: Array<{ text: string }>; role: string };
  }>;
}

@Injectable()
export class DirectorService implements IDirectorService {
  private readonly logger = new Logger(DirectorService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly modelName: string;

  constructor() {
    const apiKey = process.env.MINDLOGIC_API_KEY;
    if (!apiKey) throw new Error('MINDLOGIC_API_KEY is not set');
    
    this.apiKey = apiKey;
    this.baseUrl = process.env.MINDLOGIC_BASE_URL ?? 'https://factchat-cloud.mindlogic.ai/v1/api/google/models/generate-content';
    this.modelName = process.env.MINDLOGIC_MODEL ?? 'gemini-2.5-flash';
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

2. 중간 슬라이드들 (type: "topic") - 대본의 핵심 주제를 최대 4개까지 추출
   - 대본에 다루는 뉴스 주제 수만큼 생성 (최소 1개, 최대 4개)
   - 각 topic 슬라이드:
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
      "body": "빅테크 기업들이 AI 데이터센터 전력 문제 해결을 위해 핵에너지에 주목하고 있습니다.\n마이크로소프트·구글 등이 SMR 개발사에 수십억 달러를 투자 중입니다.\nAI 시대의 전력난 해결책으로 핵에너지가 재조명되고 있습니다.",
      "imageKeyword": "nuclear",
      "hashtags": ["#AI", "#에너지", "#원자력"],
      "accentColor": "#FF7043"
    },
    {
      "type": "topic",
      "title": "오픈AI, GPT-5 공개",
      "body": "오픈AI가 차세대 모델 GPT-5 출시 계획을 공식 발표했습니다.\n추론 능력이 기존 대비 2배 이상 향상될 것으로 알려졌습니다.\nAI 업계 패권 경쟁이 더욱 치열해질 전망입니다.",
      "imageKeyword": "artificial",
      "hashtags": ["#GPT5", "#오픈AI", "#생성AI"],
      "accentColor": "#AB47BC"
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
      const errBody = await response.text();
      throw new Error(`Mindlogic API 오류: ${response.status} - ${errBody}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Mindlogic API 응답에 텍스트 없음');


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
          { type: 'topic', title: 'AI 혁신', body: '최신 AI 기술이 다양한 산업에 변화를 가져오고 있습니다.\n글로벌 AI 투자 규모가 전년 대비 40% 이상 증가했습니다.\n기술 혁신이 일상과 비즈니스를 빠르게 재편하고 있습니다.', imageKeyword: 'artificial', accentColor: '#FF7043', hashtags: ['#AI', '#기술혁신', '#테크트렌드'] },
          { type: 'topic', title: '테크 산업 동향', body: '글로벌 빅테크 기업들이 새로운 서비스 경쟁에 돌입했습니다.\n주요 기업의 분기 실적이 시장 예상치를 상회하고 있습니다.\n기술 패권 경쟁이 더욱 치열해지는 양상입니다.', imageKeyword: 'technology', accentColor: '#AB47BC', hashtags: ['#빅테크', '#산업동향', '#테크뉴스'] },
          { type: 'closing', title: '더 자세히 들어보세요', body: '오늘의 테크 브리핑 전체 내용은 AiPod 팟캐스트에서 확인하세요.', imageKeyword: 'podcast', accentColor: '#66BB6A' },
        ],
      };
    }
  }

  async analyzeDeepDive(script: string): Promise<DeepDiveScript> {
    const prompt = `
당신은 IT 테크 미디어의 수석 에디터입니다.
아래 팟캐스트 대본에서 가장 임팩트 있는 주제 하나를 골라, 4장짜리 딥다이브 카드뉴스를 JSON으로만 작성하세요.

[카드 구성 규칙]
카드 1 (type: "deep-thumbnail") — 자극적 표지
  - title: 독자가 멈추게 만드는 자극적이고 충격적인 한국어 제목 (최대 22자, 의문문·감탄문·숫자 활용)
    예: "AI가 개발자를 전멸시킨다?", "애플 주가 하루 만에 20% 증발", "이것 모르면 도태됩니다"
  - subtitle: 제목을 보완하는 도발적인 부제 (최대 40자, 독자의 궁금증 자극)
    예: "빅테크 3사가 동시에 감원을 발표한 진짜 이유", "침묵하던 젠슨 황이 입을 열었다"
  - body: 이 카드뉴스에서 다룰 내용 한줄 티저 (최대 60자)
  - imageKeyword: Unsplash에서 반드시 검색되는 보편적 영어 단어 1개 (예: "technology", "ai", "code")
  - accentColor: 강렬하고 눈에 띄는 hex 색상

카드 2 (type: "deep-background") — 배경
  - title: "이게 왜 일어났나?" 또는 주제에 맞는 배경 섹션 제목 (최대 20자)
  - body: 사건의 배경·맥락·타임라인 (150~200자, 문장 단위로 \\n 구분, 2~3문장)
  - imageKeyword: 배경 의미의 영어 단어 1개
  - accentColor: 카드 1과 어울리되 다른 hex 색상

카드 3 (type: "deep-detail") — 핵심
  - title: "핵심이 뭔가?" 또는 주제에 맞는 핵심 섹션 제목 (최대 20자)
  - body: 핵심 사실·수치·전문가 언급 (150~200자, \\n 구분, 2~3문장)
  - imageKeyword: 핵심 내용 의미의 영어 단어 1개
  - accentColor: 다른 hex 색상

카드 4 (type: "deep-impact") — 영향
  - title: "우리에게 어떤 영향?" 또는 주제에 맞는 임팩트 섹션 제목 (최대 20자)
  - body: 독자 삶/산업에 미치는 영향과 전망 (150~200자, \\n 구분, 2~3문장)
  - imageKeyword: 영향/미래 의미의 영어 단어 1개
  - accentColor: 다른 hex 색상

[공통 규칙]
- theme: 'dark' 또는 'light' (뉴스 무게에 따라 선택)
- mood: 'serious' | 'bright' | 'urgent'
- topicTitle: 선택한 주제의 원래 제목 (20자 이내)
- 모든 card에 imageKeyword 필드 반드시 포함

반드시 아래 JSON 형식으로만 응답 (마크다운 없이):
{
  "theme": "dark",
  "mood": "urgent",
  "topicTitle": "오픈AI GPT-5 출시",
  "cards": [
    {
      "type": "deep-thumbnail",
      "title": "GPT-5, 인간 지능을 넘어섰다",
      "subtitle": "오픈AI가 공개를 미뤄온 진짜 이유가 밝혀졌다",
      "body": "AI 역사의 분기점, 지금부터 달라집니다",
      "imageKeyword": "artificial",
      "accentColor": "#FF4444"
    },
    {
      "type": "deep-background",
      "title": "이게 왜 일어났나?",
      "body": "오픈AI는 18개월간 극비리에 GPT-5를 개발해왔습니다.\\n내부 안전 검토만 6개월이 소요됐고 총 비용은 2조 원을 초과했습니다.\\n경쟁사 구글 제미나이의 추격이 출시를 앞당긴 결정적 이유입니다.",
      "imageKeyword": "laboratory",
      "accentColor": "#FF7043"
    },
    {
      "type": "deep-detail",
      "title": "핵심이 뭔가?",
      "body": "GPT-5는 추론 벤치마크에서 GPT-4o 대비 평균 40% 성능 향상을 기록했습니다.\\n특히 수학·코딩 분야에서 박사급 전문가 수준을 처음으로 초월했습니다.\\n멀티모달 실시간 처리 속도도 10배 이상 빨라졌습니다.",
      "imageKeyword": "data",
      "accentColor": "#AB47BC"
    },
    {
      "type": "deep-impact",
      "title": "우리에게 어떤 영향?",
      "body": "소프트웨어 개발자의 업무 방식이 근본적으로 바뀔 전망입니다.\\n코딩 보조 도구 시장이 향후 2년 내 10배 이상 성장할 것으로 예측됩니다.\\n지금 AI 역량을 키우지 않으면 경쟁에서 도태될 수 있습니다.",
      "imageKeyword": "future",
      "accentColor": "#66BB6A"
    }
  ]
}

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
      const errBody = await response.text();
      throw new Error(`Mindlogic API 오류 (딥다이브): ${response.status} - ${errBody}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Mindlogic API 응답에 텍스트 없음 (딥다이브)');

    try {
      const cleaned = text.replace(/```json?|```/g, '').trim();
      return JSON.parse(cleaned) as DeepDiveScript;
    } catch {
      this.logger.warn('DeepDive Director 응답 파싱 실패, 기본값 사용');
      return {
        theme: 'dark',
        mood: 'urgent',
        topicTitle: 'AI 최신 동향',
        cards: [
          { type: 'deep-thumbnail', title: 'AI가 세상을 뒤흔든다', subtitle: '빅테크가 숨기고 싶었던 진실', body: '지금 알아야 할 AI 혁명의 실체', imageKeyword: 'artificial', accentColor: '#FF4444' },
          { type: 'deep-background', title: '이게 왜 일어났나?', body: '글로벌 AI 경쟁이 새로운 국면에 접어들었습니다.\n빅테크 기업들이 수조 원을 쏟아붓고 있습니다.\n기술 패권 경쟁의 판도가 빠르게 바뀌고 있습니다.', imageKeyword: 'technology', accentColor: '#FF7043' },
          { type: 'deep-detail', title: '핵심이 뭔가?', body: '최신 AI 모델이 기존 대비 성능을 대폭 향상시켰습니다.\n전문가들은 이번 변화를 산업 전환점으로 평가합니다.\n실제 활용 사례가 빠르게 늘어나고 있습니다.', imageKeyword: 'data', accentColor: '#AB47BC' },
          { type: 'deep-impact', title: '우리에게 어떤 영향?', body: 'AI 도입으로 업무 생산성이 크게 향상될 전망입니다.\n새로운 직종이 생겨나고 기존 직종은 변화를 맞이합니다.\n지금 AI 역량을 키우는 것이 경쟁력의 핵심입니다.', imageKeyword: 'future', accentColor: '#66BB6A' },
        ],
      };
    }
  }
}
