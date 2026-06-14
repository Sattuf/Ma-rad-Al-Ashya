# سجل التغييرات — Changelog

جميع التغييرات الملحوظة في المشروع موثقة هنا.

## [0.4.0] - 2026-06-14

### Sprint 3 — الأسبوع 7: خدمة الإعلانات (Listings Service)

#### أُضيف
- **خدمة الإعلانات (`listings-service`)**:
  - خدمة مصغرة جديدة للتعامل مع الإعلانات والفئات عبر المنفذ `3002`.
  - Migration SQL (`V005__listings_schema.sql`) لإنشاء جداول `categories`, `listings`, و `listing_images` مع إدراج الفئات الأساسية.
  - إعداد 10 Endpoints للإعلانات تشمل الإنشاء، التعديل، الحذف المؤقت (Soft Delete)، إضافة وحذف الصور، التجديد، والبحث.
  - إضافة رفع متعدد للصور (حد أقصى 10 صور لكل إعلان، بحجم أقصى 5 ميجابايت للصورة) مع تحقق بنوع الملف (JPEG/PNG/WEBP).
  - استخدام `Sharp` لضغط كل صورة مرفوعة بحجمين: النسخة الكاملة (1200x1200) بجودة 85%، ونسخة مصغرة Thumbnail (300x300) بجودة 70%.
  - تطبيق استراتيجية S3 (مع Mock للتطوير المحلي عبر مسار `/tmp/avatars/`).
  - تحسين أداء عداد المشاهدات عبر الاعتماد على `Redis INCR` وتشغيل `Cron Job` كل 5 دقائق لمزامنة الأرقام مع قاعدة بيانات `PostgreSQL`.
  - حماية المسارات برمز الـ JWT المتوافق مع `auth-service` للعمليات الخاصة بالبائع.
  - شجرة الفئات (مستوى رئيسي وفرعي) مع Endpoint خاص بها `/categories`.
- **البنية التحتية**:
  - إضافة التوجيه الخاص بـ `/listings` و `/categories` في `api-gateway` ليوجه نحو المنفذ `3002`.
  - تحديث `docker-compose.yml` لإضافة الحاوية الخاصة بالخدمة.
- **التوثيق والاختبارات**:
  - تغطية الخدمة بـ 4 اختبارات وحدة للإنشاء، الاستعلام، الحماية (403)، وقواعد التجديد.
  - توثيق جميع المسارات باستخدام `Swagger`.

## [0.3.0] - 2026-06-14

### Sprint 2 — الأسبوع 6: ملف المستخدم والإشعارات

#### أُضيف
- **خدمة المستخدمين (`users-service`)**:
  - خدمة مصغرة جديدة للتعامل مع حسابات المستخدمين بمعزل عن المصادقة.
  - إعداد مخزن S3 (محاكى للاستخدام المحلي حالياً بمسار `/tmp/avatars/`) لرفع الصورة الشخصية (Avatar) باستخدام `Multer` وضغطها عبر `Sharp`.
  - Migration SQL (`V004__add_profile_fields.sql`) لإضافة حقول: `full_name`, `bio`, `city`, `avatar_url` مع تفضيلات الإشعارات الثلاثة.
  - إضافة `GET /profile`, `PUT /profile`, `POST /profile/avatar`, `PUT /notifications`.
  - حماية المسارات برمز الـ JWT المتوافق مع `auth-service`.
- **البنية التحتية (`api-gateway` & `docker-compose`)**:
  - إضافة التوجيه `/api/v1/users/*` عبر API Gateway.
  - تضمين حاوية `users-service` في البيئة الموحدة (Docker).
- **تطبيق الجوال (`Flutter`)**:
  - إنشاء 3 شاشات جديدة: عرض الملف (`ProfileScreen`)، تعديل الملف والصورة (`EditProfileScreen`)، وإعدادات الإشعارات (`NotificationsScreen`).
  - السماح للمستخدم باختيار صورة وقصها (Crop) محلياً قبل الرفع باستخدام حزم `image_picker` و `image_cropper`.
  - الاعتماد على `Riverpod` لحفظ حالة الملف الشخصي في `ProfileState`.
- **تطبيق الويب (`Next.js`)**:
  - بناء صفحات الملف الشخصي والإعدادات بتخطيط (Layout) موحد وحديث يدعم العربية (RTL).
  - الاعتماد على `react-dropzone` لرفع الصورة وسحبها، وضغطها محلياً في المتصفح باستخدام `browser-image-compression`.
  - واجهات إعدادات إشعارات متقدمة وأنيقة بتفعيل التعديل الفوري عند النقر.

## [0.2.0] - 2026-06-14

### Sprint 2 — الأسبوع 5: شاشات المصادقة (Flutter + Next.js)

#### أُضيف
- **Flutter Mobile App**:
  - إعداد هيكلية Riverpod و GoRouter و Dio.
  - تطبيق ثيم مميز (Emerald/Teal) متوافق مع العرض العربي (RTL).
  - إنشاء 5 شاشات: `SplashScreen`, `LoginScreen`, `RegisterScreen`, `OtpScreen`, و `HomeScreen`.
  - إدارة حالة المصادقة (`AuthState`) وربطها مع مخزن آمن `flutter_secure_storage`.
  - اعتراض طلبات Dio (Interceptors) لإضافة رمز الوصول وتجديده تلقائياً.
  - اختبار `login_screen_test.dart` يعمل بنجاح.
- **Next.js Web App**:
  - إعداد Tailwind CSS v4، Zustand، و Axios.
  - تخطيط مصادقة (Auth Layout) ببطاقة مركزية أنيقة مع تدرجات لونية.
  - إنشاء 3 صفحات: `/login`, `/register`, و `/verify-otp`.
  - اعتراض طلبات Axios لإضافة رمز الوصول من `localStorage` وتجديده عبر `Cookies`.
  - إضافة `middleware.ts` لحماية المسارات.
  - إعداد بيئة Jest واختبار `login.test.tsx` الذي اجتاز الفحص.
- **auth-service**:
  - إضافة نهايات طرفية (Endpoints) لـ `POST /auth/google/token` و `POST /auth/facebook/token`.
  - دمج `google-auth-library` و `fetch` للتحقق من الرموز المميزة لتطبيقات الجوال من جانب الخادم (Server-Side).

## [0.1.0] - 2026-06-14

### Sprint 1 — الأسبوعان 3+4: خدمة المصادقة الكاملة (Auth Service)

#### أُضيف
- خدمة المصادقة (`auth-service`) متكاملة مع 11 endpoint:
  - التسجيل والدخول والتحقق والخروج والجلسة الحالية (`register`, `login`, `refresh`, `logout`, `me`).
  - تسجيل الدخول الاجتماعي عبر Google OAuth و Facebook OAuth.
  - تسجيل الدخول برمز OTP مؤقت (بديل لكلمة المرور) عبر Twilio Verify.
- آلية الحماية الثنائية للرموز (Dual-Token JWT) مع تدوير الرموز (Rotation):
  - Access Token صالح لمدة 15 دقيقة.
  - Refresh Token صالح لمدة 7 أيام مع حفظه في Redis وحمايته ضد إعادة الاستخدام (Rotation reuse detection).
- نظام حماية OTP ضد الاختراق (Brute-force):
  - قفل الرقم مؤقتاً لمدة 15 دقيقة بعد 5 محاولات تحقق خاطئة.
  - تحديد معدل إرسال الرموز (Rate-limiting) بحد أقصى رسالة كل 60 ثانية.
- تعديلات قاعدة البيانات عبر Migration SQL:
  - `V002__alter_users_auth.sql`: إضافة `role` و `status` و `is_email_verified` وجعل الهاتف وكلمة المرور nullable.
  - `V003__add_oauth_fields.sql`: إضافة حقول `google_id` و `facebook_id` ونوع المزود `auth_provider`.
- اختبارات وحدة شاملة (10 اختبارات):
  - 5 اختبارات لـ `AuthService` (التسجيل، التعارض، الدخول، فشل الدخول، التجديد والتدوير).
  - 5 اختبارات لـ `OtpService` (الإرسال، حد المعدل، التحقق، الفشل، القفل المؤقت).

#### تعديلات
- تحديث `services/auth-service/package.json` لتنزيل مكتبات TypeORM, PG, Redis, Passport, Twilio.
- تحديث `services/auth-service/src/app.module.ts` لربط جميع وحدات الخدمة.
- تحديث `services/auth-service/src/main.ts` لتفعيل الـ ValidationPipe والـ CORS ومستندات Swagger مع Bearer Auth.

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
