export type SlideType = 'cover' | 'topic' | 'closing';

export interface CardSlide {
  type: SlideType;
  title: string;
  body: string;
  imageKeyword: string;
  accentColor: string;
  hashtags?: string[];  // 예: ["#에너지", "#지속가능성", "#원자력"]
  imageUrl?: string | null; // Unsplash 원본 이미지 URL (프론트 렌더링용)
}

export interface CardNewsScript {
  theme: 'dark' | 'light';
  mood: 'serious' | 'bright' | 'urgent';
  slides: CardSlide[];   // [표지, 주제1..N, 마무리]
}

// ─── 딥다이브 카드뉴스 (1 주제 × 4장) ───────────────────────────────────────

export type DeepDiveSlideType = 'deep-thumbnail' | 'deep-background' | 'deep-detail' | 'deep-impact';

export interface DeepDiveCard {
  type: DeepDiveSlideType;
  title: string;        // 자극적 제목 (thumbnail) 또는 섹션 제목
  subtitle?: string;    // 부제 (thumbnail 전용)
  body: string;         // 본문 내용
  accentColor: string;  // 강조 색상
  imageKeyword: string; // Unsplash 검색 키워드 (thumbnail 이미지용)
  imageUrl?: string | null;
}

export interface DeepDiveScript {
  theme: 'dark' | 'light';
  mood: 'serious' | 'bright' | 'urgent';
  topicTitle: string;   // 다루는 주제 원제목
  cards: DeepDiveCard[]; // 항상 4장: thumbnail → background → detail → impact
}

export interface IDirectorService {
  analyze(script: string): Promise<CardNewsScript>;
  analyzeDeepDive(script: string): Promise<DeepDiveScript>;
}
