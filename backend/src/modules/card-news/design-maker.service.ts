import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CardSlide } from './interfaces/director.service.interface';
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
      font-family: 'Pretendard', sans-serif; /* Noto Sans 대신 트렌디한 Pretendard로 변경 */
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
