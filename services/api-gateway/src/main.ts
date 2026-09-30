import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import * as express from 'express';
import helmet from 'helmet';

import * as Sentry from '@sentry/node';
import { SentryExceptionFilter } from './filters/sentry-exception.filter';
import { JsonLogger, installRequestIdPropagation, requestContextMiddleware, scrubSentryEvent } from './common/logging';

const DEV_CORS_ORIGINS = ['http://localhost:3100', 'http://localhost:8080', 'http://localhost:5000'];

/** Allowed browser origins from CORS_ORIGINS (comma separated); none by default in production. */
function corsOrigins(): string[] {
  if (process.env.CORS_ORIGINS) {
    return process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return process.env.NODE_ENV === 'production' ? [] : DEV_CORS_ORIGINS;
}

async function bootstrap() {
  const jsonLogger = new JsonLogger('api-gateway');
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

  const logger = new Logger('APIGateway');

  // Set TRUST_PROXY_HOPS to the number of load balancers in front of the gateway. Default 0:
  // otherwise clients could spoof X-Forwarded-For and dodge the rate limiter.
  app.getHttpAdapter().getInstance().set('trust proxy', parseInt(process.env.TRUST_PROXY_HOPS || '0', 10));
  // Swagger UI needs inline scripts, so CSP is relaxed outside production only.
  app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false }));
  // Photos are embedded by the website, which is served from another origin than the API:
  // helmet's `Cross-Origin-Resource-Policy: same-origin` makes browsers refuse them. Only
  // media is opened up; access to private media is still decided by the owning service.
  app.use('/api/v1/media', (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });

  // Webhooks are verified against the exact bytes the vendor signed, so keep them raw.
  app.use(['/api/v1/promotions/webhook', '/api/v1/identity/kyc/webhook'], express.raw({ type: 'application/json', limit: '1mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // تفعيل CORS للتطبيقات العميلة
  app.enableCors({
    origin: corsOrigins(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
  });

  // إعداد Swagger
  const config = new DocumentBuilder()
    .setTitle('معرض الأشياء — API Gateway')
    .setDescription(
      'بوابة API الموحدة — Unified API Gateway for Ma\'rad Al-Ashya\' Marketplace',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('Health', 'فحص صحة الخدمة')
    .addTag('Proxy', 'توجيه الطلبات للخدمات المصغرة')
    .build();
  if (process.env.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`🚀 API Gateway is running on http://localhost:${port}`);
  logger.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
  logger.log(`🏥 Health check: http://localhost:${port}/health`);
  logger.log(`🔀 Proxy routes: http://localhost:${port}/api/v1/{service}/*`);
}
bootstrap();

