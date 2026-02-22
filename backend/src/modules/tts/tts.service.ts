import * as fs from 'fs';
import * as path from 'path';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EpisodesService } from '../episodes/episodes.service';

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly fishSpeechUrl: string;
  private readonly outputDir: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly episodesService: EpisodesService,
  ) {
    this.fishSpeechUrl = this.configService.get<string>(
      'FISH_SPEECH_URL',
      'http://localhost:8080',
    );
    this.outputDir = path.resolve(
      this.configService.get<string>('AUDIO_OUTPUT_DIR', './audio-files'),
    );
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  async generateAudio(episodeId: string): Promise<{ audioPath: string }> {
    const episode = await this.episodesService.findOne(episodeId);

    if (!episode.script) {
      throw new InternalServerErrorException('Episode has no script to convert');
    }

    // processing 상태로 업데이트
    await this.episodesService.updateAudioStatus(episodeId, 'processing');

    try {
      this.logger.log(`Fish Speech TTS 요청 시작: episodeId=${episodeId}`);

      const response = await fetch(`${this.fishSpeechUrl}/v1/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: episode.script,
          format: 'mp3',
          // reference_id 없이 기본 목소리 사용
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Fish Speech API 오류: ${response.status} ${response.statusText} - ${errorBody}`,
        );
      }

      const audioBuffer = await response.arrayBuffer();
      const fileName = `${episodeId}.mp3`;
      const filePath = path.join(this.outputDir, fileName);

      fs.writeFileSync(filePath, Buffer.from(audioBuffer));
      this.logger.log(`오디오 파일 저장 완료: ${filePath}`);

      // DB audioPath 업데이트 + 상태 done
      await this.episodesService.updateAudioPath(episodeId, {
        audioPath: filePath,
      });
      await this.episodesService.updateAudioStatus(episodeId, 'done');

      return { audioPath: filePath };
    } catch (error) {
      await this.episodesService.updateAudioStatus(episodeId, 'failed');
      this.logger.error(`TTS 생성 실패: episodeId=${episodeId}`, error);
      throw new InternalServerErrorException(
        `TTS 생성 실패: ${(error as Error).message}`,
      );
    }
  }
}
