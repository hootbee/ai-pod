import * as fs from 'fs';
import { Injectable, Logger } from '@nestjs/common';
import ffmpeg = require('fluent-ffmpeg');

@Injectable()
export class AudioOptimizationService {
  private readonly logger = new Logger(AudioOptimizationService.name);

  /**
   * WAV → 최적화된 MP3 변환
   * - 64kbps CBR, 모노, 22050Hz, loudnorm 적용
   * - 음성 콘텐츠 기준 원본 대비 약 75% 파일 크기 절감
   * @returns 변환 성공 여부 (false 시 호출자가 WAV 원본으로 fallback 처리)
   */
  convertWavToOptimizedMp3(wavPath: string, outputPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      ffmpeg(wavPath)
        .audioCodec('libmp3lame')
        .audioBitrate(64)
        .audioChannels(1)      // 모노: 팟캐스트/뉴스 음성에 스테레오 정보 없음
        .audioFrequency(22050) // 22050Hz: 음성 대역(~8kHz) 대비 충분한 나이퀴스트 마진
        .audioFilters('loudnorm=I=-16:TP=-1.5:LRA=11') // EBU R128 loudness 정규화
        .outputOptions(['-id3v2_version 3'])
        .on('end', () => {
          this.logger.log(`MP3 변환 완료: ${outputPath}`);
          resolve(true);
        })
        .on('error', (err: Error) => {
          this.logger.error(`MP3 변환 실패: ${err.message}`);
          resolve(false);
        })
        // loudnorm 분석 로그(verbose)는 억제
        .on('stderr', () => {})
        .save(outputPath);
    });
  }

  /** best-effort 파일 삭제: 실패 시 무시 */
  safeUnlink(...paths: string[]): void {
    for (const p of paths) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        // 정리 실패는 치명적 오류가 아님
      }
    }
  }
}
