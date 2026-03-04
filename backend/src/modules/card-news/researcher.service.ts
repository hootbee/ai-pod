import { Injectable, Logger } from '@nestjs/common';
import type {
  ImageResult,
  IResearcherService,
} from './interfaces/researcher.service.interface';

@Injectable()
export class ResearcherService implements IResearcherService {
  private readonly logger = new Logger(ResearcherService.name);
  private readonly baseUrl = 'https://api.unsplash.com';

  private get accessKey(): string {
    const key = process.env.UNSPLASH_ACCESS_KEY;
    if (!key) throw new Error('UNSPLASH_ACCESS_KEY is not set');
    return key;
  }

  async findImage(keywords: string | string[]): Promise<ImageResult | null> {
    // Gemini가 배열 대신 문자열로 반환하는 경우 방어
    const keywordArray = Array.isArray(keywords) ? keywords : [keywords];
    const query = keywordArray[0];
    this.logger.log(`Unsplash 검색 키워드: "${query}"`);
    const url = `${this.baseUrl}/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=squarish`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Client-ID ${this.accessKey}`,
          'Accept-Version': 'v1',
        },
      });

      if (!response.ok) {
        this.logger.warn(`Unsplash API 실패: ${response.status}`);
        return null;
      }

      const data = (await response.json()) as {
        results: Array<{
          urls: { regular: string };
          description: string | null;
          user: { name: string };
        }>;
      };

      if (!data.results.length) {
        // 복합어인 경우 첫 단어만으로 재시도
        const firstWord = query.split(' ')[0];
        if (firstWord && firstWord !== query) {
          this.logger.warn(`결과 없음 → 폴백 재시도: "${firstWord}"`);
          return this.findImage(firstWord);
        }
        this.logger.warn(`이미지 검색 결과 없음: ${query}`);
        return null;
      }

      const photo = data.results[0];
      this.logger.log(`이미지 찾음: ${photo.urls.regular}`);

      return {
        url: photo.urls.regular,
        description: photo.description,
        credit: photo.user.name,
      };
    } catch (error) {
      this.logger.error('Unsplash API 오류', error);
      return null;
    }
  }
}
