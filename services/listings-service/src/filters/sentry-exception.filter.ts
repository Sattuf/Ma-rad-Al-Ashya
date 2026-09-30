import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { currentRequestId } from '../common/logging';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('UnhandledError');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500) Sentry.captureException(exception, { tags: { request_id: currentRequestId() } });
      response.status(status).json(exception.getResponse());
      return;
    }

    // Express middleware (static files, body parser) reports client errors as plain errors
    // carrying a 4xx status: a missing file is a 404, malformed JSON a 400, too large a 413.
    // Those are the client's, not bugs: answer with that status and do not alert.
    const { status: rawStatus, statusCode } = (exception ?? {}) as { status?: unknown; statusCode?: unknown };
    const clientStatus = rawStatus ?? statusCode;
    if (typeof clientStatus === 'number' && clientStatus >= 400 && clientStatus < 500) {
      response.status(clientStatus).json({ statusCode: clientStatus, message: clientStatus === 404 ? 'Not found' : 'Bad request' });
      return;
    }

    // Anything else is a bug: report it and keep the stack in the logs. The client only
    // gets a generic message (no internals leak).
    Sentry.captureException(exception, { tags: { request_id: currentRequestId() } });
    const request = ctx.getRequest();
    const err = exception instanceof Error ? exception : new Error(String(exception));
    // Path only: query strings can carry tokens.
    const path = String(request?.originalUrl ?? request?.url ?? '').split('?')[0];
    this.logger.error(`${request?.method} ${path}: ${err.message}`, err.stack);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}
