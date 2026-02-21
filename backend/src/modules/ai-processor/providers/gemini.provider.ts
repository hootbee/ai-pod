import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AiProvider, PodcastScript } from '../interfaces/ai-provider.interface';

@Injectable()
export class GeminiProvider implements AiProvider {
  private readonly model;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const genAi = new GoogleGenerativeAI(apiKey);
    this.model = genAi.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  async generatePodcastScript(newsContent: string): Promise<PodcastScript> {
    const prompt = [
      'You are a news podcast script writer.',
      'Create a short podcast script in Korean for the following news.',
      'Return the result in this exact format:',
      'TITLE: <title>',
      'SCRIPT: <script>',
      '',
      newsContent,
    ].join('\n');

    const result = await this.model.generateContent(prompt);
    const text = result.response.text().trim();
    return this.parseResponse(text);
  }

  private parseResponse(text: string): PodcastScript {
    const titleMatch = text.match(/^TITLE:\s*(.+)$/im);
    const scriptMatch = text.match(/^SCRIPT:\s*([\s\S]+)$/im);

    return {
      title: titleMatch?.[1]?.trim() || 'Podcast Script',
      script: scriptMatch?.[1]?.trim() || text,
    };
  }
}
