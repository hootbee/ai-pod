import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EpisodesService } from '../episodes/episodes.service';
import type { ScriptSegment } from '../ai-processor/interfaces/ai-provider.interface';


@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly outputDir: string;
  private readonly apiKey: string;
  // Google Cloud TTS API - Chirp 3 HD
  private readonly ttsEndpoint =
    'https://texttospeech.googleapis.com/v1/text:synthesize';

  private readonly VOICE = 'ko-KR-Chirp3-HD-Charon'; // Chirp 3 HD, Charon 화자

  constructor(
    private readonly configService: ConfigService,
    private readonly episodesService: EpisodesService,
  ) {
    const key = this.configService.get<string>('GOOGLE_CLOUD_TTS_API_KEY');
    if (!key) throw new Error('GOOGLE_CLOUD_TTS_API_KEY is not set');
    this.apiKey = key;

    this.outputDir = path.resolve(
      this.configService.get<string>('AUDIO_OUTPUT_DIR', './audio-files'),
    );
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  // ──────────────────────────────────────────────
  // 공개 메서드
  // ──────────────────────────────────────────────

  async generateAudio(episodeId: string): Promise<{ audioPath: string }> {
    const episode = await this.episodesService.findOne(episodeId);
    if (!episode.script) {
      throw new InternalServerErrorException('Episode has no script');
    }
    await this.episodesService.updateAudioStatus(episodeId, 'processing');

    try {
      const segments = this.parseScriptToSegments(episode.script);
      this.logger.log(`TTS 시작: episodeId=${episodeId}, segments=${segments.length}`);

      const audioBuffer = segments.length > 0
        ? await this.generateWithPauses(segments)
        : await this.generateChunked(episode.script);

      const dateStr = new Date(episode.createdAt).toISOString().slice(0, 10).replace(/-/g, '');
      const baseName = `${dateStr}-${episodeId.slice(0, 8)}`;
      const wavPath = path.join(this.outputDir, `${baseName}.wav`);
      const mp3Path = path.join(this.outputDir, `${baseName}.mp3`);
      fs.writeFileSync(wavPath, audioBuffer);
      this.convertToMp3(wavPath, mp3Path);

      await this.episodesService.updateAudioPath(episodeId, { audioPath: mp3Path });
      await this.episodesService.updateAudioStatus(episodeId, 'done');
      return { audioPath: mp3Path };
    } catch (error) {
      await this.episodesService.updateAudioStatus(episodeId, 'failed');
      this.logger.error(`TTS 실패: ${(error as Error).message}`);
      throw new InternalServerErrorException(`TTS 생성 실패: ${(error as Error).message}`);
    }
  }

  /** 테스트 */
  async testGenerate(text?: string): Promise<string> {
    const DEFAULT_SCRIPT = [
      'narrator: 안녕하세요, 테크 인사이트입니다. 오늘도 함께해주셔서 감사합니다.',
      'narrator: 오늘은 두 가지 AI 소식을 준비했습니다.',
      'narrator: 첫 번째 소식입니다. 오픈AI가 새로운 모델을 발표했습니다.',
      'narrator: 이번 모델은 추론 능력이 크게 향상됐으며 벤치마크 기준 이전 대비 40% 이상 개선됐습니다.',
      'narrator: 기업들의 도입 속도도 훨씬 빨라질 것으로 예상됩니다.',
      '---TOPIC_CHANGE---',
      'narrator: 두 번째 소식으로 넘어가겠습니다. 이번엔 반도체 시장 이야기입니다.',
      'narrator: 엔비디아가 신형 칩을 발표했습니다. AI 학습 속도를 기존 대비 두 배 높였다고 합니다.',
      'narrator: 데이터센터 시장에 큰 영향을 줄 것으로 보입니다.',
      'narrator: 오늘 소식 여기서 마무리하겠습니다. 다음 에피소드에서 또 뵙겠습니다!',
    ].join('\n');

    const rawText = text ?? DEFAULT_SCRIPT;
    this.logger.log('[TEST] TTS 테스트 시작');

    const segments = this.parseScriptToSegments(rawText);
    const audioBuffer = segments.length > 0
      ? await this.generateWithPauses(segments)
      : await this.generateChunked(rawText);

    const wavPath = path.join(this.outputDir, 'test.wav');
    const mp3Path = path.join(this.outputDir, 'test.mp3');
    fs.writeFileSync(wavPath, audioBuffer);
    this.convertToMp3(wavPath, mp3Path);
    this.logger.log(`[TEST] 저장 완료: ${mp3Path}`);
    return mp3Path;
  }

  // ──────────────────────────────────────────────
  // 내부 메서드
  // ──────────────────────────────────────────────

  /** script 텍스트 → ScriptSegment 배열 파싱 */
  private parseScriptToSegments(script: string): ScriptSegment[] {
    const lines = script.split('\n').map((l) => l.trim());
    const segments: ScriptSegment[] = [];
    let nextIsTopicChange = false;

    for (const line of lines) {
      if (line === '---TOPIC_CHANGE---') { nextIsTopicChange = true; continue; }
      if (!line.startsWith('narrator:')) continue;
      const text = line.replace(/^narrator:\s*/, '').trim();
      if (!text) continue;
      segments.push({
        speaker: 'speaker1',
        text,
        isTopicChange: nextIsTopicChange || undefined,
      });
      nextIsTopicChange = false;
    }

    return segments;
  }

  /**
   * 세그먼트 → SSML 빌드 후 TTS 호출
   * - 4000바이트 이하: 단일 호출
   * - 4000바이트 초과: 토픽 변경(isTopicChange) 기준으로 청크 분할 후 각각 호출
   */
  private async generateWithPauses(segments: ScriptSegment[]): Promise<Buffer> {
    const ssml = this.buildSsml(segments);
    const byteLen = Buffer.byteLength(ssml, 'utf8');
    this.logger.log(`TTS 시작 (SSML): ${segments.length}개 세그먼트, ${byteLen}bytes`);

    // 4000bytes 이하 → 단일 호출
    if (byteLen <= 4000) {
      const result = await this.callGeminiTts(ssml, true);
      return this.addWavHeader(result.pcm, result.sampleRate);
    }

    // 4000bytes 초과 → 토픽 단위 청크 분할
    this.logger.log(`SSML ${byteLen}bytes 초과 → 토픽 단위 분할`);
    const topicChunks = this.splitSegmentsByTopic(segments);
    const pcmBuffers: Buffer[] = [];
    let sampleRate = 24000;

    for (let i = 0; i < topicChunks.length; i++) {
      const chunkSsml = this.buildSsml(topicChunks[i]);
      const chunkBytes = Buffer.byteLength(chunkSsml, 'utf8');
      this.logger.log(`토픽 청크 [${i + 1}/${topicChunks.length}] ${chunkBytes}bytes`);
      const result = await this.callGeminiTts(chunkSsml, true);
      sampleRate = result.sampleRate;

      if (i > 0) {
        // 청크 경계: 이전 끝 페이드아웃 → 무음 100ms → 현재 시작 페이드인
        const prev = pcmBuffers[pcmBuffers.length - 1];
        pcmBuffers[pcmBuffers.length - 1] = this.applyFade(prev, 'out', 20, sampleRate);
        pcmBuffers.push(this.makeSilence(100, sampleRate));
        pcmBuffers.push(this.applyFade(result.pcm, 'in', 20, sampleRate));
      } else {
        pcmBuffers.push(result.pcm);
      }
    }

    return this.addWavHeader(Buffer.concat(pcmBuffers), sampleRate);
  }

  /** isTopicChange 기준으로 세그먼트를 토픽 청크로 분리 후,
   *  각 토픽이 maxBytes 초과 시 세그먼트 단위로 추가 분할 */
  private splitSegmentsByTopic(segments: ScriptSegment[], maxBytes = 4000): ScriptSegment[][] {
    // 1단계: 토픽 단위 분리
    const topicGroups: ScriptSegment[][] = [];
    let current: ScriptSegment[] = [];
    for (const seg of segments) {
      if (seg.isTopicChange && current.length > 0) {
        topicGroups.push(current);
        current = [];
      }
      current.push(seg);
    }
    if (current.length > 0) topicGroups.push(current);

    // 2단계: 토픽 하나가 maxBytes 초과 시 세그먼트 누적 단위로 재분할
    const result: ScriptSegment[][] = [];
    for (const group of topicGroups) {
      let subChunk: ScriptSegment[] = [];
      for (const seg of group) {
        const candidate = [...subChunk, seg];
        const candidateSsml = this.buildSsml(candidate);
        if (Buffer.byteLength(candidateSsml, 'utf8') > maxBytes && subChunk.length > 0) {
          result.push(subChunk);
          subChunk = [seg];
        } else {
          subChunk = candidate;
        }
      }
      if (subChunk.length > 0) result.push(subChunk);
    }
    return result;
  }

  /** segments → SSML 문자열 생성 */
  private buildSsml(segments: ScriptSegment[]): string {
    const parts = segments.map((seg, i) => {
      const breakMs = seg.isTopicChange && i > 0 ? 800 : i > 0 ? 300 : 0;
      const breakTag = breakMs > 0 ? `<break time="${breakMs}ms"/>` : '';
      let escaped = seg.text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      // AI가 생성한 <break time="...ms"/> 태그는 이스케이프에서 복구
      escaped = escaped.replace(/&lt;break\s+time="(\d+ms)"\s*\/?&gt;/gi, '<break time="$1"/>');

      return `${breakTag}${escaped}`;
    });
    return `<speak>${parts.join('')}</speak>`;
  }

  /** 텍스트 또는 SSML을 4500자 청크로 잘라 TTS 호출 */
  private async generateChunked(input: string, isSsml = false): Promise<Buffer> {
    // SSML은 speak 태그 처리 관계로 청크 분할 없이 단일 호출
    const inputs = isSsml
      ? [input]
      : this.splitText(input, 4500).map((t) => t);

    const pcmBuffers: Buffer[] = [];
    let sampleRate = 24000;

    for (let i = 0; i < inputs.length; i++) {
      this.logger.log(`청크 [${i + 1}/${inputs.length}]`);
      const result = await this.callGeminiTts(inputs[i], isSsml);
      pcmBuffers.push(result.pcm);
      sampleRate = result.sampleRate;
    }

    return this.addWavHeader(Buffer.concat(pcmBuffers), sampleRate);
  }

  /** Cloud TTS Chirp 3 HD 호출 (text 또는 SSML 입력) */
  private async callGeminiTts(
    input: string,
    isSsml = false,
  ): Promise<{ pcm: Buffer; sampleRate: number }> {
    const body = {
      input: isSsml ? { ssml: input } : { text: input },
      voice: {
        languageCode: 'ko-KR',
        name: this.VOICE,
      },
      audioConfig: {
        audioEncoding: 'LINEAR16',
        sampleRateHertz: 24000,
      },
    };

    const response = await fetch(`${this.ttsEndpoint}?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Cloud TTS API 오류: ${response.status} - ${err}`);
    }

    const data = (await response.json()) as { audioContent: string };
    if (!data.audioContent) throw new Error('TTS 응답에 오디오 데이터 없음');

    return { pcm: Buffer.from(data.audioContent, 'base64'), sampleRate: 24000 };
  }

  /** 무음 PCM 생성 (16bit mono) */
  private makeSilence(ms: number, sampleRate: number): Buffer {
    return Buffer.alloc(Math.floor((sampleRate * ms) / 1000) * 2, 0);
  }

  /** PCM 버퍼에 선형 페이드 적용 (16bit signed LE) */
  private applyFade(pcm: Buffer, direction: 'in' | 'out', durationMs: number, sampleRate: number): Buffer {
    const fadeSamples = Math.min(Math.floor((sampleRate * durationMs) / 1000), pcm.length / 2);
    const out = Buffer.from(pcm);
    for (let i = 0; i < fadeSamples; i++) {
      const sampleIdx = direction === 'in' ? i : pcm.length / 2 - fadeSamples + i;
      const offset = sampleIdx * 2;
      if (offset + 2 > out.length) break;
      const gain = direction === 'in' ? i / fadeSamples : (fadeSamples - i) / fadeSamples;
      out.writeInt16LE(Math.round(out.readInt16LE(offset) * gain), offset);
    }
    return out;
  }

  private splitText(text: string, maxLen: number): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/(?<=[.!?。])\s+/);
    let current = '';
    for (const s of sentences) {
      if ((current + s).length > maxLen) {
        if (current) chunks.push(current.trim());
        current = s;
      } else {
        current += (current ? ' ' : '') + s;
      }
    }
    if (current) chunks.push(current.trim());
    return chunks;
  }

  /** WAV → MP3 + loudnorm 볼륨 정규화 */
  private convertToMp3(wavPath: string, mp3Path: string): void {
    try {
      execSync(
        `ffmpeg -y -i "${wavPath}" -af "loudnorm=I=-16:TP=-1.5:LRA=11" -q:a 2 "${mp3Path}"`,
        { stdio: 'pipe' },
      );
      fs.unlinkSync(wavPath);
      this.logger.log('MP3 변환 완료 (loudnorm 적용)');
    } catch {
      this.logger.warn('ffmpeg 변환 실패 - WAV 파일 유지');
    }
  }

  private addWavHeader(pcmData: Buffer, sampleRate = 24000, channels = 1, bitDepth = 16): Buffer {
    const dataSize = pcmData.length;
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * channels * (bitDepth / 8), 28);
    header.writeUInt16LE(channels * (bitDepth / 8), 32);
    header.writeUInt16LE(bitDepth, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    return Buffer.concat([header, pcmData]);
  }
}
