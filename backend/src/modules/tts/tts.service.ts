import * as fs from 'fs';
import * as path from 'path';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EpisodesService } from '../episodes/episodes.service';
import { AudioOptimizationService } from '../audio/audio-optimization.service';
import type { ScriptSegment } from '../ai-processor/interfaces/ai-provider.interface';
import type { SubtitleCue, SubtitleCueDocument } from './interfaces/subtitle-cue.interface';


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
    private readonly audioOptimizationService: AudioOptimizationService,
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

      const { audioBuffer, cues } = segments.length > 0
        ? await this.generateWithSubtitleCues(segments)
        : { audioBuffer: await this.generateChunked(episode.script), cues: [] };

      const dateStr = new Date(episode.createdAt).toISOString().slice(0, 10).replace(/-/g, '');
      const baseName = `${dateStr}-${episodeId.slice(0, 8)}`;
      const wavPath = path.join(this.outputDir, `${baseName}.wav`);
      const mp3Path = path.join(this.outputDir, `${baseName}.mp3`);
      const cuesPath = path.join(this.outputDir, `${baseName}.cues.json`);
      fs.writeFileSync(wavPath, audioBuffer);

      const converted = await this.audioOptimizationService.convertWavToOptimizedMp3(wavPath, mp3Path);
      const finalAudioPath = converted ? mp3Path : wavPath;
      if (converted) this.audioOptimizationService.safeUnlink(wavPath);

      this.writeSubtitleCues(cuesPath, cues);

      await this.episodesService.updateAudioPath(episodeId, { audioPath: finalAudioPath });
      await this.episodesService.updateAudioStatus(episodeId, 'done');
      return { audioPath: finalAudioPath };
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
    const { audioBuffer, cues } = segments.length > 0
      ? await this.generateWithSubtitleCues(segments)
      : { audioBuffer: await this.generateChunked(rawText), cues: [] };

    const wavPath = path.join(this.outputDir, 'test.wav');
    const mp3Path = path.join(this.outputDir, 'test.mp3');
    const cuesPath = path.join(this.outputDir, 'test.cues.json');
    fs.writeFileSync(wavPath, audioBuffer);

    const converted = await this.audioOptimizationService.convertWavToOptimizedMp3(wavPath, mp3Path);
    const finalAudioPath = converted ? mp3Path : wavPath;
    if (converted) this.audioOptimizationService.safeUnlink(wavPath);

    this.writeSubtitleCues(cuesPath, cues);
    this.logger.log(`[TEST] 저장 완료: ${finalAudioPath}`);
    return finalAudioPath;
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
    const { audioBuffer } = await this.generateWithSubtitleCues(segments);
    return audioBuffer;
  }

  private async generateWithSubtitleCues(
    segments: ScriptSegment[],
  ): Promise<{ audioBuffer: Buffer; cues: SubtitleCue[] }> {
    const ssml = this.buildSsml(segments);
    const byteLen = Buffer.byteLength(ssml, 'utf8');
    const pcmBuffers: Buffer[] = [];
    const cues: SubtitleCue[] = [];
    let sampleRate = 24000;
    let currentMs = 0;

    const segmentChunks =
      byteLen <= 4000 ? [segments] : this.splitSegmentsByTopic(segments);

    this.logger.log(
      `TTS 시작 (subtitle cues): 세그먼트 ${segments.length}개, 호출 청크 ${segmentChunks.length}개, 총 ${byteLen}bytes`,
    );

    for (let chunkIndex = 0; chunkIndex < segmentChunks.length; chunkIndex++) {
      const chunk = segmentChunks[chunkIndex];
      const chunkSsml = this.buildSsml(chunk);
      const chunkBytes = Buffer.byteLength(chunkSsml, 'utf8');
      this.logger.log(
        `TTS 청크 [${chunkIndex + 1}/${segmentChunks.length}]: 세그먼트 ${chunk.length}개, ${chunkBytes}bytes`,
      );
      const result = await this.callGeminiTts(chunkSsml, true);
      sampleRate = result.sampleRate;
      const chunkDurationMs = this.getPcmDurationMs(result.pcm, sampleRate);

      if (chunkIndex > 0) {
        const chunkBoundaryPauseMs = 100;
        pcmBuffers.push(this.makeSilence(chunkBoundaryPauseMs, sampleRate));
        currentMs += chunkBoundaryPauseMs;
      }

      pcmBuffers.push(result.pcm);
      cues.push(
        ...this.buildSubtitleCuesForChunk(
          chunk,
          cues.length,
          currentMs,
          chunkDurationMs,
        ),
      );
      currentMs += chunkDurationMs;
    }

    return {
      audioBuffer: this.addWavHeader(Buffer.concat(pcmBuffers), sampleRate),
      cues,
    };
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

  private normalizeCueText(text: string): string {
    return text
      .replace(/<break\s+time="(\d+ms)"\s*\/?>/gi, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildSubtitleCuesForChunk(
    segments: ScriptSegment[],
    startIndex: number,
    chunkStartMs: number,
    chunkDurationMs: number,
  ): SubtitleCue[] {
    if (segments.length === 0) return [];

    const breakDurations = segments.map((segment, index) =>
      this.getBreakMs(segment, index),
    );
    const totalBreakMs = breakDurations.reduce((sum, value) => sum + value, 0);
    const weightedTexts = segments.map((segment) =>
      this.normalizeCueText(segment.text),
    );
    const weights = weightedTexts.map((text) => this.getSpeechWeight(text));
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);
    const speechDurationMs = Math.max(chunkDurationMs - totalBreakMs, segments.length);

    const allocatedSpeechDurations = weights.map((weight, index) => {
      if (index === weights.length - 1) {
        const assigned = weights
          .slice(0, index)
          .reduce(
            (sum, _, assignedIndex) =>
              sum + Math.round((speechDurationMs * weights[assignedIndex]) / totalWeight),
            0,
          );
        return Math.max(speechDurationMs - assigned, 1);
      }
      return Math.max(Math.round((speechDurationMs * weight) / totalWeight), 1);
    });

    const cues: SubtitleCue[] = [];
    let cursorMs = chunkStartMs;

    for (let i = 0; i < segments.length; i++) {
      const pauseMs = breakDurations[i];
      cursorMs += pauseMs;

      const startMs = cursorMs;
      const endMs = startMs + allocatedSpeechDurations[i];

      cues.push({
        index: startIndex + i,
        text: weightedTexts[i],
        startMs,
        endMs,
        isTopicChange: Boolean(segments[i].isTopicChange),
      });

      cursorMs = endMs;
    }

    return cues;
  }

  private getBreakMs(segment: ScriptSegment, index: number): number {
    if (index === 0) return 0;
    return segment.isTopicChange ? 800 : 300;
  }

  private getSpeechWeight(text: string): number {
    const normalized = text.replace(/\s+/g, '');
    const punctuationCount = (normalized.match(/[,.!?;:]/g) ?? []).length;
    return Math.max(normalized.length + punctuationCount * 2, 1);
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

  private getPcmDurationMs(pcm: Buffer, sampleRate: number): number {
    const bytesPerSample = 2;
    const sampleCount = pcm.length / bytesPerSample;
    return Math.round((sampleCount / sampleRate) * 1000);
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

  private writeSubtitleCues(filePath: string, cues: SubtitleCue[]) {
    const document: SubtitleCueDocument = {
      version: 1,
      cues,
    };
    fs.writeFileSync(filePath, JSON.stringify(document, null, 2), 'utf8');
  }
}
