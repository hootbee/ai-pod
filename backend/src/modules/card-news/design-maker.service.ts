import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CardSlide } from './interfaces/director.service.interface';
import type { IDesignMakerService } from './interfaces/design-maker.service.interface';

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
      ? `<div style="font-size: 24px; color: ${textColor}; font-weight: 500; margin-bottom: 12px;">${paragraphs[0]}</div>
         <div style="font-size: 22px; color: ${accent}; font-weight: 400; margin-bottom: 12px;">${paragraphs[1]}</div>
         <div style="font-size: 20px; color: ${textColor}; opacity: 0.7; font-style: italic;">${paragraphs.slice(2).join('<br>')}</div>`
      : `<div style="font-size: 26px; color: #888;">${slide.body}</div>`;

    const imageHtml = imageUrl
      ? `<div style="position: absolute; inset: 0; background-image: url('${imageUrl}'); background-size: cover; background-position: center;"></div>
         <div style="position: absolute; inset: 0; background-color: ${accent}; opacity: 0.55;"></div>`
      : `<div style="position: absolute; inset: 0; background: linear-gradient(135deg, ${accent}88, ${accent}22);"></div>`;

    const hashtagsHtml = (slide.hashtags ?? []).length > 0
      ? `<div style="display: flex; gap: 12px; align-items: center; height: 60px; padding: 0 50px; background: ${cardBg};">
           ${slide.hashtags!.map(tag => `<span style="color: ${accent}; font-size: 18px; font-weight: 600;">${tag}</span>`).join('')}
         </div>`
      : '';

    let contentHtml = '';

    if (slide.type === 'cover') {
      contentHtml = `
        ${imageHtml}
        <div style="position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 50px;">
          <div style="color: ${accent}; font-size: 24px; font-weight: 700; letter-spacing: 4px; margin-bottom: 20px;">TECH INSIGHT</div>
          <div style="color: #FFF; font-size: 72px; font-weight: 800; line-height: 1.2; margin-bottom: 30px; text-shadow: 0 4px 12px rgba(0,0,0,0.5);">${slide.title}</div>
          <div style="color: #EEE; font-size: 26px; text-shadow: 0 2px 8px rgba(0,0,0,0.5);">${slide.body}</div>
        </div>
        <div style="position: absolute; bottom: 50px; right: 50px; color: ${accent}; font-size: 24px; font-weight: 800; text-transform: lowercase;">AiPod</div>
      `;
    } else if (slide.type === 'topic') {
      contentHtml = `
        <div style="display: flex; flex-direction: column; height: 100%;">
          <div style="height: 180px; padding: 50px; background: ${cardBg}; display: flex; flex-direction: column; justify-content: center;">
            <div style="background: ${accent}; color: #FFF; border-radius: 12px; padding: 4px 12px; font-size: 14px; font-weight: 700; width: fit-content; margin-bottom: 16px;">TECH</div>
            <div style="font-size: 52px; font-weight: 800; color: ${textColor}; line-height: 1.2;">${slide.title}</div>
          </div>
          <div style="height: 460px; position: relative; background: ${accent}; overflow: hidden;">
            ${imageHtml}
          </div>
          ${hashtagsHtml}
          <div style="flex: 1; padding: 40px 50px; background: ${cardBg}; position: relative;">
            ${bodyHtml}
            <div style="position: absolute; bottom: 40px; right: 50px; color: ${accent}; font-size: 24px; font-weight: 800; text-transform: lowercase;">AiPod</div>
          </div>
        </div>
      `;
    } else {
      // closing
      contentHtml = `
        <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 50px;">
          <div style="font-size: 80px; margin-bottom: 30px;">🎙️</div>
          <div style="font-size: 56px; font-weight: 800; color: ${textColor}; margin-bottom: 20px;">${slide.title}</div>
          <div style="font-size: 26px; color: #888; margin-bottom: 50px;">${slide.body}</div>
          <div style="background: ${accent}; color: #FFF; padding: 16px 40px; border-radius: 50px; font-size: 24px; font-weight: 700;">AiPod에서 듣기 &rarr;</div>
          <div style="margin-top: 80px; color: ${textColor}; font-size: 32px; font-weight: 800; text-transform: lowercase;">AiPod <span style="color: ${accent}">.</span></div>
        </div>
      `;
    }

    return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1080px; height: 1080px;
      font-family: 'Noto Sans KR', sans-serif;
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
