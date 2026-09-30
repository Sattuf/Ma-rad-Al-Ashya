import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as express from 'express';
import * as path from 'path';

import * as Sentry from '@sentry/node';
import { SentryExceptionFilter } from './filters/sentry-exception.filter';
import { JsonLogger, installRequestIdPropagation, requestContextMiddleware, scrubSentryEvent } from './common/logging';
import { assertRequiredSecrets, corsOrigins, isProduction } from './common/security';

async function bootstrap() {
  assertRequiredSecrets('JWT_ACCESS_SECRET', 'INTERNAL_SECRET');
  const jsonLogger = new JsonLogger('listings-service');
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: jsonLogger });
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
  
  app.use('/promotions/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  // Locally stored images (development, no S3): see storage.service localMediaUrl.
  app.use(
    '/media/listings',
    express.static(path.join(process.cwd(), 'tmp', 'listings'), { index: false, fallthrough: false, maxAge: '7d', immutable: true }),
  );

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const config = new DocumentBuilder()
    .setTitle('Listings Service')
    .setDescription('The listings service API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  if (!isProduction()) {
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, documentFactory);
  }

  await app.listen(process.env.PORT ?? 3002);
}
bootstrap();

