import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('UnhandledError');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500) Sentry.captureException(exception);
      response.status(status).json(exception.getResponse());
      return;
    }

    // Anything else is a bug: report it and keep the stack in the logs. The client only
    // gets a generic message (no internals leak).
    Sentry.captureException(exception);
    const request = ctx.getRequest();
    const err = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(`${request?.method} ${request?.url}: ${err.message}`, err.stack);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}
