import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

const context = (request: Record<string, unknown>, response: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    getHandler: () => () => undefined,
    getClass: () => class TestController {},
  }) as unknown as ExecutionContext;

describe('RequestLoggingInterceptor', () => {
  it('정상 응답을 통과시키고 요청 정보를 기록한다', () => {
    const interceptor = new RequestLoggingInterceptor();
    const logSpy = jest.spyOn(
      (interceptor as unknown as { logger: { log: (message: string) => void } }).logger,
      'log',
    );
    const handler: CallHandler = { handle: () => of({ ok: true }) };

    interceptor
      .intercept(
        context(
          {
            method: 'GET',
            originalUrl: '/health',
            requestId: 'req-1',
            user: { sub: 'user-1' },
            ip: '127.0.0.1',
            get: () => 'test-agent',
          },
          { statusCode: 200 },
        ),
        handler,
      )
      .subscribe();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('requestId=req-1'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('status=200'));
  });

  it('예외를 다시 전달하면서 error 로그를 기록한다', (done) => {
    const interceptor = new RequestLoggingInterceptor();
    const errorSpy = jest.spyOn(
      (interceptor as unknown as { logger: { error: (message: string) => void } }).logger,
      'error',
    );
    const handler: CallHandler = { handle: () => throwError(() => new Error('boom')) };

    interceptor
      .intercept(
        context(
          {
            method: 'POST',
            originalUrl: '/pipeline/run',
            requestId: 'req-2',
            ip: '127.0.0.1',
            get: () => 'test-agent',
          },
          { statusCode: 500 },
        ),
        handler,
      )
      .subscribe({
        error: (error) => {
          expect(error).toHaveProperty('message', 'boom');
          expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('requestId=req-2'));
          done();
        },
      });
  });
});
