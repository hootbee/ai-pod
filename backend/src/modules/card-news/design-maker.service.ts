import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { DesignDirection } from './interfaces/director.service.interface';
import type { IDesignMakerService } from './interfaces/design-maker.service.interface';

@Injectable()
export class DesignMakerService implements IDesignMakerService {
  private readonly logger = new Logger(DesignMakerService.name);
  private readonly model;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    const genAi = new GoogleGenerativeAI(apiKey);
    this.model = genAi.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  async generateHtml(direction: DesignDirection, imageUrl?: string | null): Promise<string> {
    const bg = direction.theme === 'dark' ? '#1a1a2e' : '#FAFAF7';
    const textColor = direction.theme === 'dark' ? '#FFFFFF' : '#1a1a2e';
    const cardBg = direction.theme === 'dark' ? '#16213e' : '#FFFFFF';

    const prompt = `
당신은 HTML/CSS 전문 개발자입니다.
아래 디자인 명세에 따라 1080×1080px 카드뉴스 HTML을 작성하세요.

[디자인 시스템 - 반드시 준수]
- 전체 크기: width 1080px, height 1080px (고정)
- 배경색: ${bg}
- 텍스트 기본색: ${textColor}
- 강조색: ${direction.accentColor}
- 카드 배경: ${cardBg}
- 폰트: 'Noto Sans KR' (Google Fonts)
- 모서리: border-radius 20px
- 패딩: 60px

[콘텐츠 명세]
- 상단 레이블: "TECH INSIGHT" (소문자, 강조색, 자간 넓게)
- 메인 헤드라인: "${direction.keyCopy}" (굵고 크게, 최소 64px)
- 서브 카피: "${direction.subCopy}" (회색 계열, 28px)
- 구분선: 강조색 2px 가로선
- 핵심 포인트 리스트: ${direction.keyPoints.map((p, i) => `${i + 1}. ${p}`).join(', ')}
  (각 포인트를 둥근 태그 형태로, 강조색 배경이나 테두리 활용)
- 하단: "AiPod" 로고 텍스트 + 날짜 (우측 정렬)

[이미지 설정]
${imageUrl ? `- 이미지 URL이 있습니다: ${imageUrl}
  <img> 태그를 절대 사용하지 말고, CSS background-image로만 처리하세요.
  카드 상단 영역(height: 420px) div에 아래 CSS를 적용하세요:
    background-image: url('${imageUrl}');
    background-size: cover;
    background-position: center center;
    border-radius: 16px 16px 0 0;
  그 위에 반투명 오버레이(rgba(0,0,0,0.3)) div를 겹쳐 텍스트 가독성을 높이세요.` : `- 이미지 없음: CSS linear-gradient 배경으로 대체하세요.`}

[절대 규칙]
- Google Fonts는 허용
- 인라인 스타일 또는 <style> 태그 사용
- 완전한 HTML 문서 (<!DOCTYPE html> 포함)
- HTML 코드만 출력 (마크다운, 설명 없이)
`.trim();

    const result = await this.model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```html?|```/g, '').trim();
    return cleaned;
  }
}
