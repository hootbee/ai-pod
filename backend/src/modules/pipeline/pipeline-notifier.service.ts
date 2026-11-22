import { Injectable, Logger } from '@nestjs/common';

export interface WebhookResult {
  attempted: boolean;
  ok: boolean;
  errorMessage?: string;
}

export interface PublishFailure {
  /** 실패한 파이프라인 단계 이름 (예: script_generation, insufficient_articles) */
  step: string | null;
  error?: unknown;
  detail?: string;
  runId?: string;
  triggerType?: string;
  episodeId?: string;
}

// Discord에서 실패 유형을 바로 구분할 수 있도록 단계 이름을 한국어 라벨로 매핑한다.
const FAILURE_LABELS: Record<string, string> = {
  run_start: '실행 기록 시작 실패',
  article_collection: '기사 수집 실패',
  insufficient_articles: '기사 부족',
  script_generation: '대본 생성 실패',
  episode_save: '에피소드 저장 실패',
  tts_completion: 'TTS 생성 실패',
};

// Discord content 최대 길이(2000자) 안에 메시지가 들어가도록 오류 본문을 자른다.
const MAX_ERROR_LENGTH = 500;

@Injectable()
export class PipelineNotifier {
  private readonly logger = new Logger(PipelineNotifier.name);

  /** 발행 실패 알림. 전송 실패는 호출자의 결과나 예외를 바꾸지 않도록 결과값으로만 돌려준다. */
  async notifyPublishFailure(failure: PublishFailure): Promise<WebhookResult> {
    let content: string;
    try {
      const label = (failure.step && FAILURE_LABELS[failure.step]) || '알 수 없는 단계 실패';
      const lines = [
        `❌ [${this.today()}] AiPod 발행 실패: ${label} (${failure.step ?? 'before_first_step'})`,
      ];
      if (failure.detail) lines.push(failure.detail);
      if (failure.episodeId) lines.push(`에피소드: ${failure.episodeId}`);
      if (failure.error !== undefined) lines.push(`오류: ${this.formatError(failure.error)}`);
      if (failure.runId) {
        lines.push(
          `run: ${failure.runId}${failure.triggerType ? ` · trigger: ${failure.triggerType}` : ''}`,
        );
      }
      content = lines.join('\n');
    } catch (err) {
      this.logger.warn(`[Pipeline] 실패 알림 메시지 생성 오류: ${String(err)}`);
      return { attempted: false, ok: false, errorMessage: 'message_build_failed' };
    }
    return this.send(content);
  }

  async send(content: string): Promise<WebhookResult> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return { attempted: false, ok: true };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        // 실패 알림은 실행 기록과 예외 전파 앞에서 기다리므로, 응답 없는 웹훅이 이를 오래 막지 않게 한다.
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        let responseBody = '';
        try {
          responseBody = await response.text();
        } catch (err) {
          responseBody = `응답 본문 읽기 실패: ${this.formatError(err)}`;
        }

        const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
        const detail = responseBody.trim().replace(/\s+/g, ' ').slice(0, 500) || '응답 본문 없음';
        this.logger.warn(`[Pipeline] 웹훅 발송 실패: status=${status}, response=${detail}`);
        return { attempted: true, ok: false, errorMessage: `HTTP ${status}: ${detail}` };
      }
      return { attempted: true, ok: true };
    } catch (err) {
      const errorMessage = this.formatError(err);
      this.logger.warn(`[Pipeline] 웹훅 요청 오류: ${errorMessage}`);
      return { attempted: true, ok: false, errorMessage };
    }
  }

  today(): string {
    return new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
  }

  private formatError(error: unknown): string {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return message.length > MAX_ERROR_LENGTH ? `${message.slice(0, MAX_ERROR_LENGTH)}…` : message;
  }
}
