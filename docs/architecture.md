# البنية المعمارية — System Architecture

> معرض الأشياء — Ma'rad Al-Ashya' C2C Marketplace

## نظرة عامة

يعتمد المشروع على بنية **Microservices** (خدمات مصغرة) حيث تتولّى كل خدمة مسؤولية محددة. جميع الخدمات تتواصل عبر **API Gateway** مركزي يعمل كنقطة دخول وحيدة للتطبيقات العميلة.

---

## مخطط البنية المعمارية

```mermaid
graph TB
    subgraph Clients["العملاء — Clients"]
        MobileApp["📱 تطبيق الجوال<br/>Flutter"]
        WebApp["🌐 تطبيق الويب<br/>Next.js"]
    end

    subgraph Gateway["بوابة API — API Gateway"]
        APIGateway["🚪 API Gateway<br/>NestJS :3000"]
    end

    subgraph CoreServices["الخدمات الأساسية — Core Services"]
        AuthService["🔐 auth-service<br/>NestJS"]
        ListingsService["📦 listings-service<br/>NestJS"]
        SearchService["🔍 search-service<br/>NestJS"]
        MessagingService["💬 messaging-service<br/>NestJS"]
        TransactionsService["💰 transactions-service<br/>NestJS"]
        IdentityService["🪪 identity-service<br/>NestJS"]
    end

    subgraph PythonServices["خدمات Python — Python Services"]
        FraudService["🛡️ fraud-service<br/>FastAPI :8001"]
        PersonalizationService["✨ personalization-service<br/>FastAPI :8002"]
    end

    subgraph DataStores["مخازن البيانات — Data Stores"]
        PostgreSQL["🐘 PostgreSQL"]
        MongoDB["🍃 MongoDB"]
        Redis["⚡ Redis"]
        Elasticsearch["🔎 Elasticsearch"]
    end

    subgraph ExternalServices["خدمات خارجية — External Services"]
        DiditAPI["🪪 Didit API<br/>التحقق من الهوية"]
        FCM["🔔 Firebase Cloud Messaging<br/>الإشعارات"]
        S3["📁 AWS S3 + CloudFront<br/>تخزين الوسائط"]
    end

    MobileApp -->|REST / WebSocket| APIGateway
    WebApp -->|REST / WebSocket| APIGateway

    APIGateway -->|REST| AuthService
    APIGateway -->|REST| ListingsService
    APIGateway -->|REST| SearchService
    APIGateway -->|WebSocket| MessagingService
    APIGateway -->|REST| TransactionsService
    APIGateway -->|REST| IdentityService
    APIGateway -->|HTTP| FraudService
    APIGateway -->|HTTP| PersonalizationService

    AuthService -->|SQL| PostgreSQL
    ListingsService -->|SQL| PostgreSQL
    TransactionsService -->|SQL| PostgreSQL
    FraudService -->|SQL Read| PostgreSQL
    PersonalizationService -->|SQL Read| PostgreSQL

    SearchService --> Elasticsearch
    MessagingService --> MongoDB
    MessagingService -->|Pub/Sub| Redis
    PersonalizationService -->|Cache| Redis

    AuthService -->|Cache| Redis
    ListingsService -->|Cache| Redis
    TransactionsService -->|Cache| Redis

    IdentityService -->|HTTPS| DiditAPI
    APIGateway -->|Push| FCM
    ListingsService -->|Media Upload| S3
```

---

## وصف الخدمات

### 1. بوابة API — API Gateway

| الخاصية | القيمة |
|---------|--------|
| **التقنية** | NestJS |
| **المنفذ** | `3000` |
| **البروتوكول** | REST + WebSocket |
| **المسؤولية** | نقطة الدخول الوحيدة لجميع الطلبات، التوجيه (Routing)، المصادقة (Authentication)، تحديد المعدّل (Rate Limiting) |

---

### 2. خدمة المصادقة — auth-service

| الخاصية | القيمة |
|---------|--------|
| **التقنية** | NestJS |
| **قاعدة البيانات** | PostgreSQL (جدول `users`) |
| **المسؤولية** | تسجيل الدخول / الخروج، التحقق من OTP، إصدار وتحقق JWT، تسجيل عبر Google/Apple |

---

### 3. خدمة الإعلانات — listings-service

| الخاصية | القيمة |
|---------|--------|
| **التقنية** | NestJS |
| **قاعدة البيانات** | PostgreSQL (جداول `listings`, `categories`, `listing_images`) |
| **المسؤولية** | إنشاء وتعديل وحذف الإعلانات، إدارة التصنيفات، رفع الصور |

---

### 4. خدمة البحث — search-service

| الخاصية | القيمة |
|---------|--------|
| **التقنية** | NestJS |
| **قاعدة البيانات** | Elasticsearch |
| **المسؤولية** | البحث النصي الكامل (Full-text Search)، التصفية المتقدمة، البحث الجغرافي |

---

### 5. خدمة المراسلة — messaging-service

| الخاصية | القيمة |
|---------|--------|
| **التقنية** | NestJS |
| **قاعدة البيانات** | MongoDB + Redis (Pub/Sub) |
| **البروتوكول** | WebSocket |
| **المسؤولية** | المحادثات الفورية بين البائع والمشتري، إشعارات الرسائل |

---

### 6. خدمة المعاملات — transactions-service

| الخاصية | القيمة |
|---------|--------|
| **التقنية** | NestJS |
| **قاعدة البيانات** | PostgreSQL (جداول `transactions`, `reviews`) |
| **المسؤولية** | إدارة عمليات البيع والشراء، تتبّع حالة التسليم، التقييمات |

---

### 7. خدمة التحقق من الهوية — identity-service

| الخاصية | القيمة |
|---------|--------|
| **التقنية** | NestJS |
| **خدمة خارجية** | Didit API |
| **المسؤولية** | التحقق من هوية المستخدمين عبر مزوّد خارجي (KYC) |

---

### 8. خدمة كشف الاحتيال — fraud-service

| الخاصية | القيمة |
|---------|--------|
| **التقنية** | Python FastAPI |
| **المنفذ** | `8001` |
| **قاعدة البيانات** | PostgreSQL (قراءة فقط) |
| **مكتبات ML** | scikit-learn |
| **المسؤولية** | تحليل الإعلانات والسلوكيات المشبوهة، تصنيف مخاطر الاحتيال |

---

### 9. خدمة التخصيص — personalization-service

| الخاصية | القيمة |
|---------|--------|
| **التقنية** | Python FastAPI |
| **المنفذ** | `8002` |
| **قاعدة البيانات** | PostgreSQL (قراءة فقط) + Redis (تخزين مؤقت) |
| **المسؤولية** | توصيات مخصصة للمستخدمين، ترتيب الإعلانات حسب التفضيلات |

---

## بروتوكولات الاتصال — Communication Protocols

```mermaid
graph LR
    subgraph Protocols["بروتوكولات الاتصال"]
        A["REST/HTTP"] -->|بين Gateway والخدمات| B["الخدمات الأساسية"]
        C["WebSocket"] -->|المراسلة الفورية| D["messaging-service"]
        E["HTTP"] -->|خدمات Python| F["fraud + personalization"]
        G["SQL"] -->|استعلامات قاعدة البيانات| H["PostgreSQL"]
        I["Pub/Sub"] -->|الرسائل الفورية| J["Redis"]
    end
```

| البروتوكول | الاستخدام |
|-----------|-----------|
| **REST/HTTP** | التواصل بين API Gateway والخدمات الأساسية (NestJS) |
| **HTTP** | التواصل بين API Gateway وخدمات Python (FastAPI) |
| **WebSocket** | المراسلة الفورية عبر `messaging-service` |
| **SQL** | استعلامات قاعدة البيانات PostgreSQL |
| **Pub/Sub (Redis)** | توزيع الرسائل الفورية بين مثيلات `messaging-service` |
| **HTTPS** | الاتصال بالخدمات الخارجية (Didit API, FCM, S3) |

---

## ملكية البيانات — Data Ownership

> المصدر الرسمي: رأس الملف `db/migrations/0001_baseline.sql`. **فقط المالك يكتب**؛ غيره يمر عبر واجهة المالك.

| الخدمة | المخزن | الجداول / المجموعات |
|--------|--------|---------------------|
| `auth-service` | PostgreSQL | `users` (أعمدة الهوية: الهاتف، البريد، كلمة المرور، الدور، الحالة، OAuth) |
| `users-service` | PostgreSQL | `users` (أعمدة الملف الشخصي والإشعارات فقط) + Redis (المفضلة) |
| `listings-service` | PostgreSQL + Redis | `categories`, `listings`, `listing_images`, `promotions` + عدّادات المشاهدات |
| `transactions-service` | PostgreSQL | `transactions`, `reviews`, `user_rating_summary` |
| `moderation-service` | PostgreSQL + Redis (Bull) | `reports`, `report_counts` |
| `identity-service` | PostgreSQL | `kyc_verifications`, `kyc_audit_logs` (بيانات مشفّرة بـ KMS) |
| `search-service` | Elasticsearch + PostgreSQL | فهرس `marad_listings` + `ab_test_results` |
| `messaging-service` | MongoDB + Redis | `conversations`, `messages` + الحضور |
| `fraud-service` | PostgreSQL + MongoDB | `fraud_signals` (كتابة) |
| `personalization-service` | MongoDB + Redis + ES | `user_events` (كتابة) + قراءة الفهرس |

**الترحيلات:** ملف SQL مرقّم في `db/migrations/NNNN_وصف.sql`، يطبّقه `db/migrate.mjs` (مع checksum وقفل استشاري وتنفيذ كل ملف في transaction). في Docker تعمل خدمة `migrate` مرة واحدة قبل أي خدمة تستخدم Postgres. في CI يُطبَّق كل شيء على قاعدة فارغة مرتين، ثم يتحقق `scripts/check-entity-schema.ts` من أن كل عمود في كيانات TypeORM موجود بنوع متوافق.

---

## التوجيه عبر البوابة — Gateway Routing

`/api/v1/{prefix}/...` → الخدمة حسب `services/api-gateway/src/proxy/services.config.ts`:

| الآلية | الغرض |
|--------|-------|
| `stripPrefix: false` | للخدمات التي تركّب متحكماتها تحت نفس الاسم (`@Controller('listings')`) |
| `ROUTE_OVERRIDES` | مسار عام تملكه خدمة أخرى: `/users/:id/reviews` → transactions-service |
| `BLOCKED_ROUTES` | مسارات داخلية لا تُعرض للعامة أبداً (دفاع إضافي فوق `INTERNAL_SECRET`) |
| `cacheableRoutes` | كاش Redis قصير للقراءات المجهولة على مسارات القوائم فقط |

**العقود:** `scripts/check-contracts.mjs` يستخرج كل استدعاء من الويب والجوال، ويمرره عبر خريطة البوابة، ويتحقق من وجود مسار مطابق (NestJS/FastAPI) — يعمل في CI.

---

## الأمان بين الخدمات — Service Security Model

| الاتجاه | الآلية |
|---------|--------|
| عميل → خدمة | JWT (HS256) يصدره auth-service؛ كل خدمة تتحقق من التوقيع بـ `JWT_ACCESS_SECRET` (`common/security.ts`) |
| خدمة → خدمة | ترويسة `x-internal-secret` تُقارن بزمن ثابت (`InternalGuard`)؛ البوابة لا تمررها من العملاء |
| مزوّد خارجي → خدمة | توقيع HMAC على الجسم الخام (Stripe، Didit) |
| مدير | دور `admin` داخل JWT (`AdminGuard`) |

الملفات المشتركة (`common/security.ts`, `common/database.ts`) منسوخة في كل خدمة لأن سياق بناء Docker هو مجلد الخدمة؛ `scripts/check-shared-copies.mjs` يمنع اختلاف النسخ.

---

## الخدمات الخارجية — External Services

| الخدمة | المزوّد | الاستخدام |
|--------|--------|-----------|
| **التحقق من الهوية** | Didit API | التحقق من هوية المستخدمين (KYC) |
| **الإشعارات** | Firebase Cloud Messaging | إشعارات الجوال (Push Notifications) |
| **تخزين الوسائط** | AWS S3 + CloudFront | تخزين وتوزيع الصور والملفات |

---

## قرارات معمارية — Architecture Decisions

1. **قاعدة Postgres واحدة بملكية جداول صارمة** بدلاً من قاعدة لكل خدمة: أبسط تشغيلياً في هذه المرحلة؛ الحدود تُفرض بالملكية الموثّقة ومراجعة الكود. الانتقال لقواعد منفصلة ممكن لاحقاً لأن لا خدمة تنفّذ JOIN على جداول غيرها.
2. **الاتصال المتزامن بين الخدمات مؤقت:** الفهرسة والإشعارات وتحليل الاحتيال تُستدعى HTTP الآن (بلا انتظار حيث أمكن). المرحلة 2: جدول Outbox + طابور (BullMQ) حتى لا يضيع أي حدث.
3. **نسخ الملفات المشتركة بدل حزمة workspace:** إلى أن تنتقل صور Docker للبناء من جذر المستودع (عندها تصبح `packages/common`).
4. **HS256 بسر مشترك:** مقبول داخل شبكة خاصة؛ المرحلة 4: RS256 بحيث لا تملك الخدمات إلا المفتاح العام.
