export interface IThumbnailPromptService {
  /**
   * 헤드라인 + 부제를 받아 이미지 생성용 영문 프롬프트를 반환
   * (LLM으로 [오브젝트], [상황], [아이콘], [색상] 채워넣기)
   */
  buildPrompt(headline: string, subtitle: string): Promise<string>;
}
