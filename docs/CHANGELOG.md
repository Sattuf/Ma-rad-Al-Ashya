# سجل التغييرات — Changelog

جميع التغييرات الملحوظة في المشروع موثقة هنا.

## [0.0.2] - 2026-06-14

### Sprint 0 — الأسبوع 2: بيئة التطوير المحلية + API Gateway + CI

#### أُضيف
- ملف `docker-compose.yml` كامل يشمل 13 حاوية:
  - 4 مخازن بيانات: PostgreSQL 16, MongoDB 7, Redis 7, Elasticsearch 8.15
  - 7 خدمات NestJS مع hot-reload عبر volume mounts
  - 2 خدمة Python FastAPI
  - شبكة `marad-network` و 4 named volumes
  - Health checks لجميع مخازن البيانات
- API Gateway مع proxy routing:
  - `ProxyController` يوجه `/api/v1/{service}/*` للخدمة المناسبة
  - دعم 8 خدمات خلفية (auth, listings, search, messages, transactions, identity, fraud, recommendations)
  - تمرير Headers (Authorization, Content-Type, إلخ) مع X-Forwarded-For
  - إرجاع 404 للخدمات غير المعروفة و 502 عند تعذر الاتصال
  - CORS مفعّل لتطبيقات Next.js و Flutter Web
  - ValidationPipe عام مع Swagger محسّن (Bearer Auth + Tags)
  - اختبارات وحدة للـ ProxyController (4 اختبارات)
- GitHub Actions CI workflow:
  - lint + test لخدمات Node.js (7 خدمات عبر matrix)
  - lint + test لخدمات Python (2 خدمتان عبر matrix)
  - Flutter analyze + test
  - Next.js lint + build
- وثيقة `infra/aws-setup.md`:
  - توثيق إعداد S3 + CloudFront (مع نماذج Terraform)
  - توثيق إعداد EKS cluster (مع أوامر eksctl)
  - توثيق RDS + ElastiCache
  - IAM roles و Security checklist
  - تقدير التكلفة المبدئي

#### تعديلات
- تحديث `services/api-gateway/src/app.module.ts` — إضافة ConfigModule + ProxyModule
- تحديث `services/api-gateway/src/main.ts` — إضافة CORS, ValidationPipe, Swagger محسّن
- تحديث `services/api-gateway/package.json` — إضافة `@nestjs/config`
- تحديث `services/api-gateway/.env.example` — إضافة URLs جميع الخدمات

---

## [0.0.1] - 2026-06-13

### Sprint 0 — الأسبوع 1: تجهيز الهيكلية الأساسية

#### أُضيف
- هيكلية Monorepo الكاملة مع جميع المجلدات والملفات الأولية
- 7 خدمات NestJS مصغرة (api-gateway, auth, listings, search, messaging, transactions, identity)
- 2 خدمة Python FastAPI (fraud-service, personalization-service)
- مشروع Flutter أساسي (apps/mobile)
- مشروع Next.js أساسي (apps/web)
- مخطط ERD أولي لقاعدة بيانات PostgreSQL (6 جداول)
- SQL Migration أولي (V001__initial_schema.sql)
- وثيقة البنية المعمارية (docs/architecture.md)
- وثيقة مخطط قاعدة البيانات (docs/database-schema.md)
- ملف docker-compose.yml مبدئي
- ملف README.md للمشروع
