import { NestFactory } from '@nestjs/core';
import * as express from 'express';
import * as path from 'path';
import { AppModule } from './app.module';

import { ValidationPipe } from '@nestjs/common';

import * as Sentry from '@sentry/node';
import { SentryExceptionFilter } from './filters/sentry-exception.filter';
import { JsonLogger, installRequestIdPropagation, requestContextMiddleware, scrubSentryEvent } from './common/logging';
import { assertRequiredSecrets, corsOrigins } from './common/security';

async function bootstrap() {
  assertRequiredSecrets('JWT_ACCESS_SECRET', 'INTERNAL_SECRET');
  const jsonLogger = new JsonLogger('users-service');
  const app = await NestFactory.create(AppModule, { logger: jsonLogger });
  // First middleware: every later step, including body parsing errors, has the request ID.
  app.use(requestContextMiddleware(jsonLogger));
  installRequestIdPropagation();
  
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    beforeSend: scrubSentryEvent,
    beforeSendTransaction: scrubSentryEvent,
  });
  app.useGlobalFilters(new SentryExceptionFilter());
  app.enableCors({ origin: corsOrigins() });
  // Locally stored avatars (development, no S3): see storage.service localMediaUrl.
  app.use(
    '/media/avatars',
    express.static(path.join(process.cwd(), 'tmp', 'avatars'), { index: false, fallthrough: false, maxAge: '7d', immutable: true }),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
