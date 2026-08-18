import { randomUUID } from 'crypto';
import type { NextFunction, Response } from 'express';
import { RequestWithContext } from '../request-context';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export class RequestIdMiddleware {
  use(request: RequestWithContext, response: Response, next: NextFunction): void {
    const incoming = request.get('x-request-id');
    const requestId = incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();

    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    next();
  }
}
