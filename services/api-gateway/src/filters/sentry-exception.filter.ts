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
