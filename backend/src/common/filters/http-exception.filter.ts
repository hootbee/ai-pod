import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RequestWithContext } from '../request-context';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<RequestWithContext>();
    const response = host
      .switchToHttp()
      .getResponse<{ status: (statusCode: number) => { json: (body: unknown) => void } }>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    this.logger.error(
      `[HTTP_ERROR] requestId=${request.requestId ?? 'missing'} method=${request.method} path=${request.originalUrl ?? request.url} status=${status}`,
    );

    response.status(status).json({
      statusCode: status,
      requestId: request.requestId ?? null,
      message: typeof message === 'string' ? message : message,
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url,
    });
  }
}
