import * as fs from 'fs';
import { Injectable, Logger } from '@nestjs/common';
import ffmpeg = require('fluent-ffmpeg');

@Injectable()
export class AudioOptimizationService {
  static readonly CHUNK_CROSSFADE_MS = 10;
  static readonly CHUNK_FADE_IN_MS = 100;

  private readonly logger = new Logger(AudioOptimizationService.name);

  /** ffprobe로 오디오 재생 시간(ms) 조회 */
  getAudioDurationMs(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(Math.round((metadata.format.duration ?? 0) * 1000));
      });
    });
  }

  /**
   * 하나 이상의 오디오 파일(M4A/WAV 등) → 최적화된 MP3 변환
   * - 64kbps CBR, 모노, 22050Hz, loudnorm 적용
   * - 여러 파일이면 concat 필터로 이어붙인 뒤 인코딩
   */
  convertFilesToOptimizedMp3(inputPaths: string[], outputPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (inputPaths.length === 0) {
        resolve(false);
        return;
      }

      let cmd = ffmpeg();
      inputPaths.forEach((p) => {
        cmd = cmd.input(p);
      });

      const baseOutputOpts = ['-id3v2_version 3'];

      if (inputPaths.length > 1) {
        const normalizedInputs = inputPaths.map(
          (_, i) =>
            `[${i}:a]aresample=22050:async=1:first_pts=0,` +
            'aformat=sample_fmts=fltp:sample_rates=22050:channel_layouts=mono' +
            `,afade=t=in:st=0:d=${AudioOptimizationService.CHUNK_FADE_IN_MS / 1000}` +
            `[a${i}]`,
        );
        const crossfades: string[] = [];
        let previous = '[a0]';
        for (let i = 1; i < inputPaths.length; i++) {
          const output = `[xf${i}]`;
          crossfades.push(
            `${previous}[a${i}]acrossfade=` +
              `d=${AudioOptimizationService.CHUNK_CROSSFADE_MS / 1000}:` +
              'c1=tri:c2=tri' +
              output,
          );
          previous = output;
        }
        const filterStr = [
          ...normalizedInputs,
          ...crossfades,
          `${previous}loudnorm=I=-16:TP=-1.5:LRA=11[out]`,
        ].join(';');
        cmd = cmd.complexFilter(filterStr).outputOptions([...baseOutputOpts, '-map [out]']);
      } else {
        cmd = cmd.audioFilters('loudnorm=I=-16:TP=-1.5:LRA=11').outputOptions(baseOutputOpts);
      }

      cmd
        .audioCodec('libmp3lame')
        .audioBitrate(64)
        .audioChannels(1)
        .audioFrequency(22050)
        .on('end', () => {
          this.logger.log(`MP3 변환 완료: ${outputPath}`);
          resolve(true);
        })
        .on('error', (err: Error) => {
          this.logger.error(`MP3 변환 실패: ${err.message}`);
          resolve(false);
        })
        .on('stderr', () => {})
        .save(outputPath);
    });
  }

  /**
   * WAV → 최적화된 MP3 변환 (PCM fallback용)
   * - 64kbps CBR, 모노, 22050Hz, loudnorm 적용
   */
  convertWavToOptimizedMp3(wavPath: string, outputPath: string): Promise<boolean> {
    return this.convertFilesToOptimizedMp3([wavPath], outputPath);
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
