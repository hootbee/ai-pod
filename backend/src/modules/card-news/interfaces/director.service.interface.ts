export type SlideType = 'cover' | 'topic' | 'closing';

export interface CardSlide {
  type: SlideType;
  title: string;
  body: string;
  imageKeyword: string;
  accentColor: string;
  hashtags?: string[];  // 예: ["#에너지", "#지속가능성", "#원자력"]
}

export interface CardNewsScript {
  theme: 'dark' | 'light';
  mood: 'serious' | 'bright' | 'urgent';
  slides: CardSlide[];   // [표지, 주제1..N, 마무리]
}

export interface IDirectorService {
  analyze(script: string): Promise<CardNewsScript>;
}
