import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

@Injectable()
export class AudioStreamService {
  private readonly logger = new Logger(AudioStreamService.name);

  /** HEAD 요청: 파일 메타데이터 헤더만 응답 */
  streamHead(filePath: string, res: Response): void {
    const fileSize = fs.statSync(filePath).size;
    this.applyBaseHeaders(res, filePath);
    res.setHeader('Content-Length', fileSize.toString());
    res.status(200).end();
  }

  /** GET 요청: Range 헤더를 해석해 206 또는 200으로 스트리밍 응답 */
  stream(filePath: string, req: Request, res: Response): void {
    const fileSize = fs.statSync(filePath).size;
    this.applyBaseHeaders(res, filePath);

    const range = req.headers.range;

    if (!range) {
      // Range 없음: 전체 파일 200 응답 (just_audio fallback)
      res.status(200).setHeader('Content-Length', fileSize.toString());
      const readStream = fs.createReadStream(filePath);
      this.pipeWithErrorHandling(readStream, res);
      return;
    }

    const parsed = this.parseRange(range, fileSize);
    if (!parsed) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    const { start, end } = parsed;
    const chunkSize = end - start + 1;

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize.toString());

    const readStream = fs.createReadStream(filePath, { start, end });
    this.pipeWithErrorHandling(readStream, res);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private applyBaseHeaders(res: Response, filePath: string): void {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
    };
    const contentType = contentTypeMap[ext] ?? 'audio/mpeg';
    const filename = encodeURIComponent(path.basename(filePath));

    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${filename}`);
  }

  private parseRange(
    rangeHeader: string,
    total: number,
  ): { start: number; end: number } | null {
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (!match) return null;

    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : total - 1;
    const safeStart = Number.isFinite(start) ? start : 0;
    const safeEnd = Number.isFinite(end) ? Math.min(end, total - 1) : total - 1;

    if (safeStart > safeEnd || safeStart < 0) return null;
    return { start: safeStart, end: safeEnd };
  }

  private pipeWithErrorHandling(stream: fs.ReadStream, res: Response): void {
    // 클라이언트 연결 종료 시 스트림 즉시 파괴 → fd 누수 방지
    res.on('close', () => stream.destroy());

    stream.on('error', (err: NodeJS.ErrnoException) => {
      // ECONNRESET / EPIPE: 클라이언트 이탈 (정상 케이스, 로그 불필요)
      if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {
        this.logger.error(`Stream read error: ${err.message}`);
      }
      res.end();
    });

    stream.pipe(res);
  }
}
