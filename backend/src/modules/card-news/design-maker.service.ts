import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CardSlide, DeepDiveCard } from './interfaces/director.service.interface';
import type { IDesignMakerService } from './interfaces/design-maker.service.interface';
import { CARD_NEWS_HEIGHT, CARD_NEWS_WIDTH } from './card-news.constants';

@Injectable()
export class DesignMakerService implements IDesignMakerService {
  private readonly logger = new Logger(DesignMakerService.name);
  private readonly model;

  constructor() {
    const apiKey = process.env.MINDLOGIC_API_KEY;
    if (!apiKey) throw new Error('MINDLOGIC_API_KEY is not set');

    const genAi = new GoogleGenerativeAI(apiKey);
    this.model = genAi.getGenerativeModel({ model: 'gemini-3-flash-preview' });
  }

  async generateHtml(slide: CardSlide, theme: 'dark' | 'light', imageUrl?: string | null): Promise<string> {
    const bg = theme === 'dark' ? '#0f0f1a' : '#FAFAF7';
    const textColor = theme === 'dark' ? '#FFFFFF' : '#0f0f1a';
    const cardBg = theme === 'dark' ? '#1a1a2e' : '#FFFFFF';
    const accent = slide.accentColor || '#4FC3F7';

    // 단락 분리 처리
    const paragraphs = (slide.body || '').split('\\n').filter((p) => p.trim());
    const bodyHtml = slide.type === 'topic' && paragraphs.length >= 3
      ? `<div style="font-size: 30px; color: ${textColor}; font-weight: 700; line-height: 1.38; margin-bottom: 14px; word-break: keep-all;">${paragraphs[0]}</div>
         <div style="font-size: 24px; color: ${accent}; font-weight: 700; line-height: 1.4; margin-bottom: 14px; word-break: keep-all;">${paragraphs[1]}</div>
         <div style="font-size: 22px; color: ${textColor}; opacity: 0.76; line-height: 1.55; word-break: keep-all;">${paragraphs.slice(2).join('<br>')}</div>`
      : `<div style="font-size: 24px; color: ${textColor}; opacity: 0.82; line-height: 1.55; word-break: keep-all;">${slide.body}</div>`;

    const imageHtml = imageUrl
      ? `<div style="position: absolute; inset: 0; background-image: url('${imageUrl}'); background-size: cover; background-position: center;"></div>
         <div style="position: absolute; inset: 0; background-color: ${accent}; opacity: 0.4;"></div>`
      : `<div style="position: absolute; inset: 0; background: linear-gradient(135deg, ${accent}88, ${accent}22);"></div>`;

    const hashtagsHtml = (slide.hashtags ?? []).length > 0
      ? `<div style="display: flex; gap: 16px; align-items: center; padding: 24px 50px; background: ${cardBg}; flex-wrap: wrap;">
           ${slide.hashtags!.map(tag => `<span style="color: ${accent}; font-size: 24px; font-weight: 600;">#${tag}</span>`).join('')}
         </div>`
      : '';

    let contentHtml = '';

    if (slide.type === 'cover') {
      contentHtml = `
        ${imageHtml}
        <div style="position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 80px;">
          <div style="color: ${accent}; font-size: 26px; font-weight: 700; letter-spacing: 5px; margin-bottom: 24px;">TECH INSIGHT</div>
          <div style="color: #FFF; font-size: 72px; font-weight: 800; line-height: 1.16; margin-bottom: 28px; text-shadow: 0 6px 16px rgba(0,0,0,0.6); word-break: keep-all;">${slide.title}</div>
          <div style="color: #EEE; font-size: 28px; line-height: 1.5; text-shadow: 0 4px 12px rgba(0,0,0,0.6); word-break: keep-all; max-width: 820px;">${slide.body}</div>
        </div>
        <div style="position: absolute; bottom: 44px; right: 48px; color: ${accent}; font-size: 28px; font-weight: 800; text-transform: lowercase; text-shadow: 0 4px 8px rgba(0,0,0,0.5);">aipod</div>
      `;
    } else if (slide.type === 'topic') {
      contentHtml = `
        <div style="position: relative; display: flex; flex-direction: column; height: 100%; padding: 42px; background: ${bg}; gap: 22px;">
          <div style="padding: 34px 36px; background: ${cardBg}; border-radius: 34px;">
            <div style="background: ${accent}; color: #FFF; border-radius: 999px; padding: 10px 18px; font-size: 18px; font-weight: 700; width: fit-content; margin-bottom: 18px;">TECH</div>
            <div style="font-size: 50px; font-weight: 800; color: ${textColor}; line-height: 1.2; letter-spacing: -0.02em; word-break: keep-all; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${slide.title}</div>
          </div>

          <div style="display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr); gap: 22px; flex: 1; min-height: 0;">
            <div style="position: relative; overflow: hidden; border-radius: 34px; min-height: 0;">
              ${imageHtml}
            </div>

            <div style="display: flex; flex-direction: column; min-height: 0;">
              <div style="flex: 1; min-height: 0; padding: 32px 30px 24px; background: ${cardBg}; border-radius: 34px; box-shadow: 0 18px 36px rgba(0,0,0,0.08);">
                <div style="height: 100%; overflow: hidden;">
                  ${bodyHtml}
                </div>
              </div>

              ${hashtagsHtml
                ? `<div style="display: flex; gap: 10px; align-items: center; padding: 18px 22px; background: ${cardBg}; border-radius: 28px; flex-wrap: wrap; margin-top: 16px;">
                     ${slide.hashtags!.map(tag => `<span style="color: ${accent}; font-size: 18px; font-weight: 700;">#${tag}</span>`).join('')}
                   </div>`
                : ''}
            </div>
          </div>

          <div style="position: absolute; right: 62px; bottom: 52px; color: ${accent}; font-size: 26px; font-weight: 800; text-transform: lowercase;">aipod</div>
        </div>
      `;
    } else {
      // closing
      contentHtml = `
        <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 80px;">
          <div style="font-size: 96px; margin-bottom: 28px;">🎙️</div>
          <div style="font-size: 58px; font-weight: 800; color: ${textColor}; margin-bottom: 22px; line-height: 1.18; word-break: keep-all;">${slide.title}</div>
          <div style="font-size: 26px; color: #888; line-height: 1.5; margin-bottom: 56px; word-break: keep-all; max-width: 760px;">${slide.body}</div>
          <div style="background: ${accent}; color: #FFF; padding: 18px 42px; border-radius: 999px; font-size: 28px; font-weight: 700;">aipod에서 듣기 &rarr;</div>
          <div style="margin-top: 72px; color: ${textColor}; font-size: 36px; font-weight: 800; text-transform: lowercase;">aipod <span style="color: ${accent}">.</span></div>
        </div>
      `;
    }

    return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: ${CARD_NEWS_WIDTH}px;
      height: ${CARD_NEWS_HEIGHT}px;
      font-family: 'Pretendard', sans-serif;
      background-color: ${bg};
      overflow: hidden;
      position: relative;
    }
  </style>
</head>
<body>
  ${contentHtml}
</body>
</html>
    `.trim();
  }

  generateDeepDiveHtml(card: DeepDiveCard, theme: 'dark' | 'light', cardIndex: number, imageUrl?: string | null): string {
    const bg = theme === 'dark' ? '#0a0a14' : '#FAFAF7';
    const textColor = theme === 'dark' ? '#FFFFFF' : '#0f0f1a';
    const cardBg = theme === 'dark' ? '#16162a' : '#FFFFFF';
    const accent = card.accentColor || '#FF4444';

    const badgeLabels: Record<string, string> = {
      'deep-thumbnail': 'DEEP DIVE',
      'deep-background': '배경',
      'deep-detail': '핵심',
      'deep-impact': '영향',
    };
    const badge = badgeLabels[card.type] ?? 'DEEP DIVE';
    const progress = `${cardIndex}/4`;

    const paragraphs = (card.body || '').split('\\n').filter((p) => p.trim());
    const bodyHtml = paragraphs
      .map((p, i) => {
        if (i === 0) return `<div style="font-size: 34px; color: ${textColor}; font-weight: 700; line-height: 1.45; margin-bottom: 20px; word-break: keep-all;">${p}</div>`;
        if (i === 1) return `<div style="font-size: 30px; color: ${accent}; font-weight: 600; line-height: 1.45; margin-bottom: 20px; word-break: keep-all;">${p}</div>`;
        return `<div style="font-size: 27px; color: ${textColor}; opacity: 0.78; line-height: 1.6; word-break: keep-all;">${p}</div>`;
      })
      .join('');

    let contentHtml = '';

    if (card.type === 'deep-thumbnail') {
      // 썸네일: 텍스트 중심 표지 (임시 — 이미지 없음)
      const overlayStyle = imageUrl
        ? `background-image: url('${imageUrl}'); background-size: cover; background-position: center;`
        : `background: linear-gradient(135deg, ${accent}33 0%, #0a0a14 60%);`;

      contentHtml = `
        <div style="position: relative; width: 100%; height: 100%; ${overlayStyle}">
          <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.9) 100%);"></div>

          <!-- 상단 배지 영역 -->
          <div style="position: absolute; top: 56px; left: 56px; right: 56px; display: flex; justify-content: space-between; align-items: center;">
            <div style="background: ${accent}; color: #FFF; padding: 12px 28px; border-radius: 999px; font-size: 24px; font-weight: 800; letter-spacing: 2px;">DEEP DIVE</div>
            <div style="color: rgba(255,255,255,0.6); font-size: 24px; font-weight: 600;">${progress}</div>
          </div>

          <!-- 중앙 텍스트 -->
          <div style="position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 80px 60px;">
            <div style="color: ${accent}; font-size: 26px; font-weight: 700; letter-spacing: 3px; margin-bottom: 28px; text-transform: uppercase;">Breaking</div>
            <div style="color: #FFF; font-size: 76px; font-weight: 800; line-height: 1.14; margin-bottom: 32px; word-break: keep-all; text-shadow: 0 4px 20px rgba(0,0,0,0.5);">${card.title}</div>
            <div style="width: 80px; height: 4px; background: ${accent}; border-radius: 2px; margin-bottom: 30px;"></div>
            <div style="color: rgba(255,255,255,0.88); font-size: 34px; font-weight: 500; line-height: 1.5; word-break: keep-all; text-shadow: 0 2px 8px rgba(0,0,0,0.4);">${card.subtitle ?? ''}</div>
          </div>

          <!-- 하단 티저 + aipod -->
          <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 28px 56px; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); display: flex; justify-content: space-between; align-items: center;">
            <div style="color: rgba(255,255,255,0.75); font-size: 24px; word-break: keep-all; max-width: 760px;">${card.body}</div>
            <div style="color: ${accent}; font-size: 28px; font-weight: 800; text-transform: lowercase; flex-shrink: 0; margin-left: 24px;">aipod</div>
          </div>
        </div>
      `;
    } else {
      // 콘텐츠 카드 (배경/핵심/영향)
      contentHtml = `
        <div style="position: relative; width: 100%; height: 100%; background: ${bg}; display: flex; flex-direction: column; padding: 52px 52px 48px;">

          <!-- 상단 헤더 -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 36px;">
            <div style="display: flex; align-items: center; gap: 16px;">
              <div style="width: 6px; height: 44px; background: ${accent}; border-radius: 3px;"></div>
              <div style="background: ${accent}22; color: ${accent}; padding: 10px 24px; border-radius: 999px; font-size: 24px; font-weight: 800; letter-spacing: 1px;">${badge}</div>
            </div>
            <div style="color: ${textColor}; opacity: 0.35; font-size: 24px; font-weight: 700;">${progress}</div>
          </div>

          <!-- 제목 -->
          <div style="font-size: 58px; font-weight: 800; color: ${textColor}; line-height: 1.18; margin-bottom: 36px; word-break: keep-all; letter-spacing: -0.02em;">${card.title}</div>

          <!-- 구분선 -->
          <div style="width: 100%; height: 1.5px; background: ${accent}44; margin-bottom: 36px;"></div>

          <!-- 본문 -->
          <div style="flex: 1; background: ${cardBg}; border-radius: 28px; padding: 44px 46px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.12);">
            ${bodyHtml}
          </div>

          <!-- 하단 branding -->
          <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 28px;">
            <div style="color: ${accent}; font-size: 26px; font-weight: 800; text-transform: lowercase; opacity: 0.9;">aipod</div>
          </div>
        </div>
      `;
    }

    return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: ${CARD_NEWS_WIDTH}px;
      height: ${CARD_NEWS_HEIGHT}px;
      font-family: 'Pretendard', sans-serif;
      background-color: ${bg};
      overflow: hidden;
      position: relative;
    }
  </style>
</head>
<body>
  ${contentHtml}
</body>
</html>
    `.trim();
  }
}
