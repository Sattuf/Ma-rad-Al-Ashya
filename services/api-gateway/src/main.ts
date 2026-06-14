import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('APIGateway');

  // تفعيل CORS للتطبيقات العميلة
  app.enableCors({
    origin: [
      'http://localhost:3100', // Next.js dev
      'http://localhost:8080', // Flutter web dev
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
  });

  // Validation pipe عام
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

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
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`🚀 API Gateway is running on http://localhost:${port}`);
  logger.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
  logger.log(`🏥 Health check: http://localhost:${port}/health`);
  logger.log(`🔀 Proxy routes: http://localhost:${port}/api/v1/{service}/*`);
}
bootstrap();

