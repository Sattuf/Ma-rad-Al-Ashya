import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import * as Sentry from '@sentry/node';
import { SentryExceptionFilter } from './filters/sentry-exception.filter';
import { JsonLogger, installRequestIdPropagation, requestContextMiddleware, scrubSentryEvent } from './common/logging';
import { assertRequiredSecrets, corsOrigins, isProduction } from './common/security';

async function bootstrap() {
  assertRequiredSecrets('JWT_ACCESS_SECRET', 'INTERNAL_SECRET');
  const jsonLogger = new JsonLogger('search-service');
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

  const config = new DocumentBuilder()
    .setTitle('Search Service')
    .setDescription('خدمة البحث — Search Service (Elasticsearch)')
    .setVersion('0.1.0')
    .build();
  if (!isProduction()) {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3003);
  const logger = new Logger('SearchService');
  logger.log(`Search Service is running on port ${process.env.PORT ?? 3003}`);
}
bootstrap();
