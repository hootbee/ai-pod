import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CardSlide } from './interfaces/director.service.interface';
import type { IDesignMakerService } from './interfaces/design-maker.service.interface';

@Injectable()
export class DesignMakerService implements IDesignMakerService {
  private readonly logger = new Logger(DesignMakerService.name);
  private readonly model;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    const genAi = new GoogleGenerativeAI(apiKey);
    this.model = genAi.getGenerativeModel({ model: 'gemini-3-flash-preview' });
  }

  async generateHtml(slide: CardSlide, theme: 'dark' | 'light', imageUrl?: string | null): Promise<string> {
    const bg = theme === 'dark' ? '#0f0f1a' : '#FAFAF7';
    const textColor = theme === 'dark' ? '#FFFFFF' : '#0f0f1a';
    const cardBg = theme === 'dark' ? '#1a1a2e' : '#FFFFFF';

    const imageSection = imageUrl
      ? `이미지 URL: ${imageUrl}
  - <img> 태그 금지. CSS background-image로만 처리하세요.
  - 전체 배경 또는 상단 영역(height: 380px)에 아래 CSS 적용:
    background-image: url('${imageUrl}');
    background-size: cover;
    background-position: center center;
  - 이미지 위에 강조색(${slide.accentColor}) 반투명 오버레이(opacity 0.55)를 덮으세요.
    background-color: ${slide.accentColor}; opacity: 방식 대신
    별도 div로: background: ${slide.accentColor}; opacity: 0.55; position: absolute; inset: 0;
  - 효과: 어떤 이미지가 와도 브랜드 톤으로 통일됨`
      : `이미지 없음. ${slide.accentColor} 색상의 CSS linear-gradient 배경으로 대체하세요.`;

    const slideGuide = {
      cover: `
[표지 카드 디자인]
- 전체 배경에 이미지 또는 그라디언트를 꽉 채우세요.
- 중앙에 상단 레이블 "TECH INSIGHT" (강조색, letter-spacing 넓게)
- 큰 메인 타이틀: "${slide.title}" (굵게, 최소 72px)
- 서브 텍스트: "${slide.body}" (작게, 26px, 회색)
- 하단 우측: "AiPod" 로고 텍스트 (강조색, 소문자)`,

      topic: `
[주제 카드 레이아웃 - 위에서 아래 순서]
1. 헤드라인 영역 (height: 180px, 패딩 50px)
   - 배경: ${cardBg}
   - 좌측 상단: "TECH" 태그 (강조색 배경, 흰 글씨, 둥근 모서리, 12px)
   - 메인 타이틀: "${slide.title}" (굵게, 52px, 기본 텍스트색)

2. 이미지 영역 (height: 460px, position: relative)
   - 배경색: ${slide.accentColor} (이미지 없는 영역을 채움)
   - 배경 이미지: background-size: contain, background-position: center, background-repeat: no-repeat
   - 이미지 없으면: ${slide.accentColor} linear-gradient로 대체
   - 오버레이는 생략 (이미지가 잘리지 않도록)

3. 해시태그 영역 (height: 60px, 패딩 0 50px, 배경: ${cardBg})
   - 해시태그 목록: ${(slide.hashtags ?? []).join(' ')} (없으면 생략)
   - 각 태그: 강조색(${slide.accentColor}), 18px, font-weight 600, 태그 사이 간격 12px
   - 가로로 나열 (display: flex, gap: 12px, align-items: center)

4. 본문 영역 (나머지 높이, 패딩 40px 50px)
   - 배경: ${cardBg}
   - 본문은 3개의 단락으로 구분하세요 (\\n을 <br> 또는 <p> 태그로 처리):
     · 첫 단락: 24px, 기본 텍스트색, font-weight 500 (팩트)
     · 둘째 단락: 22px, 강조색, font-weight 400 (수치/근거)
     · 셋째 단락: 20px, 기본 텍스트색 투명도 0.7, font-style italic (시사점)
   - 단락 사이 margin-bottom: 12px
   - 우측 하단: "AiPod" 로고 (강조색, 소문자, 18px)`,

      closing: `
[마무리 카드 디자인]
- 중앙 정렬 레이아웃
- 상단: 팟캐스트 마이크 아이콘 (SVG 또는 이모지 🎙)
- 메인 타이틀: "${slide.title}" (굵게, 56px)
- 본문: "${slide.body}" (26px, 회색)
- 강조색 버튼 모양 박스: "AiPod에서 듣기 →" (클릭 불가, 디자인용)
- 하단: "AiPod" 로고 + 강조색 점 장식`,
    };

    const prompt = `
당신은 HTML/CSS 전문 개발자입니다.
아래 명세에 따라 1080×1080px 카드뉴스 슬라이드 HTML을 작성하세요.

[공통 디자인 시스템]
- 크기: width 1080px, height 1080px (고정, overflow: hidden)
- 배경색: ${bg}
- 텍스트 기본색: ${textColor}
- 강조색: ${slide.accentColor}
- 카드 배경: ${cardBg}
- 폰트: 'Noto Sans KR' (Google Fonts)
- 모서리: border-radius 0px (전체 카드는 각지게)

[이미지 설정]
${imageSection}

${slideGuide[slide.type]}

[절대 규칙]
- Google Fonts 허용
- <style> 태그 사용
- 완전한 HTML 문서 (<!DOCTYPE html> 포함)
- HTML 코드만 출력 (설명, 마크다운 없이)
`.trim();

    const result = await this.model.generateContent(prompt);
    const text = result.response.text().trim();
    return text.replace(/```html?|```/g, '').trim();
  }
}
