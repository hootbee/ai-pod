export interface IThumbnailGeneratorService {
  /**
   * 프롬프트를 받아 이미지를 생성하고 파일 경로 반환
   * @param prompt 이미지 생성 프롬프트 (영문)
   * @param outputPath 저장할 파일 경로
   */
  generate(prompt: string, outputPath: string): Promise<string>;
}
