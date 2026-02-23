export interface ImageResult {
  url: string;
  description: string | null;
  credit: string; // 사진 작가명 (Unsplash 이용약관 필수)
}

export interface IResearcherService {
  findImage(keywords: string | string[]): Promise<ImageResult | null>;
}
