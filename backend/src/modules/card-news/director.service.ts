import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  CardNewsScript,
  DeepDiveScript,
  IDirectorService,
} from './interfaces/director.service.interface';

interface GeminiResponse {
  choices: Array<{
    message: { content: string; role: string };
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
    this.baseUrl = process.env.MINDLOGIC_BASE_URL ?? 'https://factchat-cloud.mindlogic.ai/v1/gateway/chat/completions/';
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
You are the chief creative director of an IT tech media company.
Read the podcast script below and respond with ONLY JSON for a multi-slide card news layout.
Today's date: ${today}

[Slide Composition Rules]
1. First slide (type: "cover")
   - title: "오늘의 테크 브리핑" or a headline encompassing the topic (max 20 Korean chars)
   - body: Format "${today} · 주요 테크 뉴스 N가지"
   - imageKeyword: One English word representing the overall topic (e.g., "technology")

2. Middle slides (type: "topic") - Extract key topics from the script
   - Generate one per news topic (min 1, max 4)
   - Each topic slide:
   - title: Core headline for that news item (max 20 Korean chars)
   - body: 3-line structure, 100~150 total chars including spaces
     · Line 1: The single most important fact (1 sentence)
     · Line 2: Specific figures or evidence for credibility (1 sentence)
     · Line 3: Implication or conclusion (1 sentence)
     Example: "오픈AI가 차세대 AI 모델 GPT-5 개발을 공식 확인했습니다.\n학습 비용만 1조 원 이상이 투입될 예정입니다.\nAI 패권 경쟁이 새로운 국면에 접어들었습니다."
   - imageKeyword: One common English word guaranteed to return results on Unsplash
     (No compound words! "gaming ai" ❌ → "gaming" ✅, "nuclear energy" ❌ → "nuclear" ✅)
   - hashtags: 2~3 Korean hashtags for the topic (e.g., ["#에너지", "#지속가능성", "#원자력"])

3. Last slide (type: "closing")
   - title: "더 자세히 들어보세요" (fixed)
   - body: "오늘의 테크 브리핑 전체 내용은 AiPod 팟캐스트에서 확인하세요."
   - imageKeyword: "podcast"

[Common Rules]
- theme: 'dark' or 'light' based on overall tone
- mood: 'serious' | 'bright' | 'urgent'
- accentColor per slide: appropriate hex color (brand color for cover, different colors per topic)

IMPORTANT: Write ALL Korean text fields (title, body, hashtags) in Korean.
Respond ONLY in the following JSON format (no markdown):
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
You are the chief editor of an IT tech media company.
Read the podcast script below, choose the single most impactful topic,
and write a 4-card deep-dive card news in JSON format only.

[Card Composition Rules]
Card 1 (type: "deep-thumbnail") — Provocative cover
  - title: Shocking, attention-stopping Korean title (max 22 chars, use questions/numbers/exclamations)
    Examples: "AI가 개발자를 전멸시킨다?", "애플 주가 하루 만에 20% 증발", "이것 모르면 도태됩니다"
  - subtitle: Provocative Korean subtitle (max 40 chars, sparks reader curiosity)
    Examples: "빅테크 3사가 동시에 감원을 발표한 진짜 이유", "침묵하던 젠슨 황이 입을 열었다"
  - body: One-line teaser for this card news (max 60 Korean chars)
  - imageKeyword: One English word guaranteed to return results on Unsplash (e.g., "technology", "ai", "code")
  - accentColor: Bold, eye-catching hex color

Card 2 (type: "deep-background") — Background
  - title: "이게 왜 일어났나?" or a fitting background section heading (max 20 Korean chars)
  - body: Background, context, and timeline of the event (150~200 Korean chars, \\n between 2~3 sentences)
  - imageKeyword: One English word
  - accentColor: Hex color complementing card 1

Card 3 (type: "deep-detail") — Core
  - title: "핵심이 뭔가?" or a fitting core section heading (max 20 Korean chars)
  - body: Key facts, figures, and expert quotes (150~200 Korean chars, \\n between sentences)
  - imageKeyword: One English word
  - accentColor: Different hex color

Card 4 (type: "deep-impact") — Impact
  - title: "우리에게 어떤 영향?" or a fitting impact section heading (max 20 Korean chars)
  - body: Real-world impact and outlook for readers and industry (150~200 Korean chars, \\n between sentences)
  - imageKeyword: One English word
  - accentColor: Different hex color

[Common Rules]
- theme: 'dark' or 'light' based on the weight of the news
- mood: 'serious' | 'bright' | 'urgent'
- topicTitle: Original title of the chosen topic (max 20 Korean chars)
- Include imageKeyword in every card

IMPORTANT: Write ALL Korean text fields (title, subtitle, body, topicTitle) in Korean.
Respond ONLY in the following JSON format (no markdown):
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
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Mindlogic API 오류 (딥다이브): ${response.status} - ${errBody}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.choices?.[0]?.message?.content;
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

  /**
   * Google Search 그라운딩을 활용해 주제를 실시간 웹 정보로 심층 분석.
   * gemini-3-flash-preview + googleSearch tool → 1회 요청으로 최신 트렌드 반영.
   * GOOGLE_AI_API_KEY 우선, 없으면 MINDLOGIC_API_KEY 사용.
   */
  async analyzeDeepDiveGrounded(script: string): Promise<DeepDiveScript> {
    const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY ?? process.env.GOOGLE_AI_API_KEY ?? this.apiKey;
    const modelName = process.env.GROUNDING_MODEL ?? 'gemini-3-flash-preview';

    const genAi = new GoogleGenerativeAI(apiKey);
    const model = genAi.getGenerativeModel({
      model: modelName,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ googleSearch: {} } as any],
    });

    const prompt = `
You are the chief editor of an IT tech media company.
Read the podcast script below and choose the single most impactful topic.
Then use Google Search to find the latest information, figures, expert opinions, and trends on that topic,
and write a 4-card deep-dive card news based on the search results — in JSON format only.

[Core Principles]
- Use the script only to identify the topic
- All card content MUST be based on the latest web information from Google Search
- Include specific figures, dates, names, and company names as much as possible
- Be concrete enough that readers feel they are learning something new

[Card Composition]
Card 1 (type: "deep-thumbnail") — Provocative cover
  - title: Shocking, search-informed Korean title (max 22 chars, use questions/numbers)
  - subtitle: Provocative Korean subtitle (max 40 chars, hint at the latest facts)
  - body: One-line Korean teaser (max 60 chars)
  - imageKeyword: One English word for Unsplash
  - accentColor: Bold hex color

Card 2 (type: "deep-background") — Background
  - title: Section heading (max 20 Korean chars)
  - body: Search-sourced background, context, timeline (150~200 Korean chars, \\n between 2~3 sentences, include specific dates/figures)
  - imageKeyword: One English word
  - accentColor: Hex color

Card 3 (type: "deep-detail") — Core
  - title: Section heading (max 20 Korean chars)
  - body: Search-sourced key data, expert quotes, latest figures (150~200 Korean chars, \\n between sentences, source-like tone)
  - imageKeyword: One English word
  - accentColor: Hex color

Card 4 (type: "deep-impact") — Impact
  - title: Section heading (max 20 Korean chars)
  - body: Search-based practical impact, outlook, and call to action for readers (150~200 Korean chars, \\n between sentences)
  - imageKeyword: One English word
  - accentColor: Hex color

[Common Rules]
- theme: 'dark' or 'light'
- mood: 'serious' | 'bright' | 'urgent'
- topicTitle: Name of the chosen topic (max 20 Korean chars)
- Respond ONLY in JSON (no markdown)

IMPORTANT: Write ALL Korean text fields (title, subtitle, body, topicTitle) in Korean.

[Podcast Script — for topic identification only]
${script.slice(0, 2000)}
`.trim();

    this.logger.log(`[GROUNDED] Google Search 그라운딩 딥다이브 분석 시작 (model: ${modelName})`);

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    this.logger.log(`[GROUNDED] 그라운딩 응답 수신 (${text.length}자)`);

    try {
      const cleaned = text.replace(/```json?|```/g, '').trim();
      const parsed = JSON.parse(cleaned) as DeepDiveScript;
      this.logger.log(`[GROUNDED] 파싱 성공: 주제="${parsed.topicTitle}", 카드 ${parsed.cards?.length ?? 0}장`);
      return parsed;
    } catch {
      this.logger.warn('[GROUNDED] JSON 파싱 실패, 비그라운딩 fallback 실행');
      return this.analyzeDeepDive(script);
    }
  }
}
