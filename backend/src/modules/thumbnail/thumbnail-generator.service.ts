import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { IThumbnailGeneratorService } from './interfaces/thumbnail-generator.service.interface';

type GatewayImageItem = {
  b64_json?: string;
  url?: string;
};

interface GatewayImageResponse {
  data?: GatewayImageItem[];
}

/**
 * 책임: 완성된 프롬프트 → gemini-3-pro-image-preview API 호출 → PNG 파일 저장 (SRP)
 */
@Injectable()
export class ThumbnailGeneratorService implements IThumbnailGeneratorService {
  private readonly logger = new Logger(ThumbnailGeneratorService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly modelName: string;
  private readonly quality: string;

  constructor() {
    const apiKey = process.env.MINDLOGIC_API_KEY;
    if (!apiKey) throw new Error('MINDLOGIC_API_KEY is not set');
    this.apiKey = apiKey;
    // 이미지 전용 게이트웨이 엔드포인트
    this.baseUrl =
      process.env.THUMBNAIL_IMAGE_BASE_URL ??
      'https://factchat-cloud.mindlogic.ai/v1/gateway/images/generate/';
    this.modelName = process.env.THUMBNAIL_IMAGE_MODEL ?? 'gemini-2.5-flash-image';
    this.quality = process.env.THUMBNAIL_IMAGE_QUALITY ?? 'high';
  }

  async generate(prompt: string, outputPath: string): Promise<string> {
    this.logger.log(
      `[Generator] 이미지 생성 요청: ${outputPath} (model=${this.modelName})`,
    );

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        prompt,
        quality: this.quality,
        number_of_images: 1,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`이미지 생성 API 오류: ${response.status} - ${err}`);
    }

    const data = (await response.json()) as GatewayImageResponse;
    const image = data.data?.[0];
    if (!image) {
      throw new Error(`이미지 API 응답에 data[0] 없음 (model=${this.modelName})`);
    }

    let buffer: Buffer;
    if (image.b64_json) {
      buffer = Buffer.from(image.b64_json, 'base64');
    } else if (image.url) {
      const imageResponse = await fetch(image.url);
      if (!imageResponse.ok) {
        throw new Error(`이미지 URL 다운로드 실패: ${imageResponse.status}`);
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      throw new Error('이미지 API 응답에 b64_json 또는 url이 없음');
    }

    // 출력 디렉터리 생성 후 파일 저장
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buffer);

    this.logger.log(`[Generator] 이미지 저장 완료: ${outputPath} (${buffer.length} bytes)`);
    return outputPath;
  }
}
