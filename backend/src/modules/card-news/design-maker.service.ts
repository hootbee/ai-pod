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
      ? `<div style="font-size: 32px; color: ${textColor}; font-weight: 500; margin-bottom: 16px;">${paragraphs[0]}</div>
         <div style="font-size: 28px; color: ${accent}; font-weight: 400; margin-bottom: 16px;">${paragraphs[1]}</div>
         <div style="font-size: 26px; color: ${textColor}; opacity: 0.7; font-style: italic; line-height: 1.5;">${paragraphs.slice(2).join('<br>')}</div>`
      : `<div style="font-size: 32px; color: #888; line-height: 1.5;">${slide.body}</div>`;

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
        <div style="position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 60px;">
          <div style="color: ${accent}; font-size: 32px; font-weight: 700; letter-spacing: 6px; margin-bottom: 30px;">TECH INSIGHT</div>
          <div style="color: #FFF; font-size: 96px; font-weight: 800; line-height: 1.2; margin-bottom: 40px; text-shadow: 0 6px 16px rgba(0,0,0,0.6); word-break: keep-all;">${slide.title}</div>
          <div style="color: #EEE; font-size: 36px; line-height: 1.5; text-shadow: 0 4px 12px rgba(0,0,0,0.6); word-break: keep-all;">${slide.body}</div>
        </div>
        <div style="position: absolute; bottom: 60px; right: 60px; color: ${accent}; font-size: 36px; font-weight: 800; text-transform: lowercase; text-shadow: 0 4px 8px rgba(0,0,0,0.5);">aipod</div>
      `;
    } else if (slide.type === 'topic') {
      // 비율 기반(Flex) 분할로 모바일 세로 화면에 꽉 차게 변경
      contentHtml = `
        <div style="display: flex; flex-direction: column; height: 100%;">
          <div style="padding: 60px 50px 40px; background: ${cardBg};">
            <div style="background: ${accent}; color: #FFF; border-radius: 16px; padding: 8px 20px; font-size: 20px; font-weight: 700; width: fit-content; margin-bottom: 24px;">TECH</div>
            <div style="font-size: 64px; font-weight: 800; color: ${textColor}; line-height: 1.25; word-break: keep-all;">${slide.title}</div>
          </div>
          
          <div style="flex: 4; position: relative; background: ${accent}; overflow: hidden;">
            ${imageHtml}
          </div>
          
          ${hashtagsHtml}
          
          <div style="flex: 3; padding: 50px; background: ${cardBg}; position: relative;">
            ${bodyHtml}
            <div style="position: absolute; bottom: 50px; right: 50px; color: ${accent}; font-size: 32px; font-weight: 800; text-transform: lowercase;">aipod</div>
          </div>
        </div>
      `;
    } else {
      // closing
      contentHtml = `
        <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 60px;">
          <div style="font-size: 120px; margin-bottom: 40px;">🎙️</div>
          <div style="font-size: 72px; font-weight: 800; color: ${textColor}; margin-bottom: 30px; word-break: keep-all;">${slide.title}</div>
          <div style="font-size: 36px; color: #888; line-height: 1.5; margin-bottom: 80px; word-break: keep-all;">${slide.body}</div>
          <div style="background: ${accent}; color: #FFF; padding: 24px 60px; border-radius: 60px; font-size: 36px; font-weight: 700;">aipod에서 듣기 &rarr;</div>
          <div style="margin-top: 120px; color: ${textColor}; font-size: 48px; font-weight: 800; text-transform: lowercase;">aipod <span style="color: ${accent}">.</span></div>
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
      width: 1080px; 
      height: 1920px; /* 9:16 모바일 세로 비율로 수정! */
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