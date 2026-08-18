import { RequestIdMiddleware } from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  it('유효한 request id가 없으면 새 UUID를 생성하고 응답 헤더에 설정한다', () => {
    const middleware = new RequestIdMiddleware();
    const request = { headers: {}, get: () => undefined } as never;
    const response = { setHeader: jest.fn() } as never;

    middleware.use(request, response, jest.fn());

    expect(request.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.setHeader).toHaveBeenCalledWith('X-Request-Id', request.requestId);
  });

  it('검증된 X-Request-Id는 재사용한다', () => {
    const middleware = new RequestIdMiddleware();
    const request = {
      headers: { 'x-request-id': 'client-request-123' },
      get: () => 'client-request-123',
    } as never;
    const response = { setHeader: jest.fn() } as never;

    middleware.use(request, response, jest.fn());

    expect(request.requestId).toBe('client-request-123');
  });

  it('너무 길거나 허용되지 않은 request id는 새로 생성한다', () => {
    const middleware = new RequestIdMiddleware();
    const request = {
      headers: { 'x-request-id': 'a'.repeat(129) },
      get: () => 'a'.repeat(129),
    } as never;
    const response = { setHeader: jest.fn() } as never;

    middleware.use(request, response, jest.fn());

    expect(request.requestId).not.toBe('a'.repeat(129));
  });
});
