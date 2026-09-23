import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { catchError, finalize, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import { AUDIT_ACTION_METADATA } from '../decorators/audit-action.decorator';
import { RequestWithContext } from '../request-context';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithContext & { user?: { sub?: string } }>();
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();
    const startedAt = Date.now();
    const method = request.method;
    const path = request.originalUrl ?? request.url;
    const requestId = request.requestId ?? 'missing';
    const userId = request.user?.sub ?? 'anonymous';
    const action = this.reflector.get<string | undefined>(
      AUDIT_ACTION_METADATA,
      context.getHandler(),
    );
    let errorLogged = false;

    return next.handle().pipe(
      catchError((error: unknown) => {
        errorLogged = true;
        this.logger.error(
          `[HTTP] requestId=${requestId} userId=${userId} method=${method} path=${path} error=${this.formatError(error)}`,
        );
        return throwError(() => error);
      }),
      finalize(() => {
        const durationMs = Date.now() - startedAt;
        const actionPart = action ? ` action=${action}` : '';
        const level = errorLogged ? 'warn' : 'log';
        this.logger[level](
          `[HTTP] requestId=${requestId} userId=${userId} method=${method} path=${path} status=${response.statusCode} durationMs=${durationMs}${actionPart}`,
        );
      }),
    );
  }

  private formatError(error: unknown): string {
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
}
