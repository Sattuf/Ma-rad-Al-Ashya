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

## ملكية قواعد البيانات — Database Ownership

كل خدمة تمتلك مجموعة محددة من الجداول أو مخازن البيانات:

```mermaid
graph LR
    subgraph PostgreSQL["🐘 PostgreSQL"]
        UsersTable["users"]
        ListingsTable["listings"]
        CategoriesTable["categories"]
        ListingImagesTable["listing_images"]
        TransactionsTable["transactions"]
        ReviewsTable["reviews"]
    end

    AuthService["auth-service"] -->|owner| UsersTable
    ListingsService["listings-service"] -->|owner| ListingsTable
    ListingsService -->|owner| CategoriesTable
    ListingsService -->|owner| ListingImagesTable
    TransactionsService["transactions-service"] -->|owner| TransactionsTable
    TransactionsService -->|owner| ReviewsTable

    FraudService["fraud-service"] -.->|read-only| PostgreSQL
    PersonalizationService["personalization-service"] -.->|read-only| PostgreSQL
```

| الخدمة | مخزن البيانات | الوصول |
|--------|--------------|--------|
| `auth-service` | PostgreSQL — `users` | قراءة وكتابة (Owner) |
| `listings-service` | PostgreSQL — `listings`, `categories`, `listing_images` | قراءة وكتابة (Owner) |
| `search-service` | Elasticsearch | قراءة وكتابة (Owner) |
| `messaging-service` | MongoDB + Redis | قراءة وكتابة (Owner) |
| `transactions-service` | PostgreSQL — `transactions`, `reviews` | قراءة وكتابة (Owner) |
| `fraud-service` | PostgreSQL | قراءة فقط |
| `personalization-service` | PostgreSQL + Redis | قراءة فقط (PG) + تخزين مؤقت (Redis) |

---

## الخدمات الخارجية — External Services

| الخدمة | المزوّد | الاستخدام |
|--------|--------|-----------|
| **التحقق من الهوية** | Didit API | التحقق من هوية المستخدمين (KYC) |
| **الإشعارات** | Firebase Cloud Messaging | إشعارات الجوال (Push Notifications) |
| **تخزين الوسائط** | AWS S3 + CloudFront | تخزين وتوزيع الصور والملفات |

---

## ملاحظات معمارية

> [!IMPORTANT]
> كل خدمة مستقلة تمامًا ولها قاعدة بيانات خاصة (أو مجموعة جداول خاصة). لا تتواصل الخدمات مباشرة مع بعضها، بل عبر API Gateway.

> [!NOTE]
> خدمات Python (fraud-service و personalization-service) تعمل كخدمات مساندة وتقرأ فقط من قاعدة البيانات. لا تقوم بأي عمليات كتابة مباشرة.

> [!TIP]
> في المراحل القادمة، يمكن إضافة Message Broker (مثل RabbitMQ أو Kafka) للتواصل غير المتزامن بين الخدمات عند الحاجة.
