# معرض الأشياء — Ma'rad Al-Ashya'

> منصة سوق إلكتروني من نوع C2C (شبيهة بـ OLX / Sahibinden) تشمل تطبيق جوال وموقع ويب، تعتمد على الدفع عند اللقاء.

## 🏗️ البنية التقنية

| الطبقة | التقنية |
|--------|---------|
| تطبيق الجوال | Flutter (Dart) |
| الويب | Next.js (React + TypeScript) |
| API Gateway | NestJS + Kong |
| الخدمات المصغرة | Node.js + NestJS (TypeScript) |
| الذكاء الآلي | Python + FastAPI + scikit-learn |
| قاعدة البيانات | PostgreSQL + MongoDB |
| التخزين المؤقت | Redis |
| محرك البحث | Elasticsearch |
| الرسائل الفورية | Socket.io |
| الحاويات | Docker + AWS EKS |

## 📁 هيكلية المشروع

```
marad/
├── apps/
│   ├── mobile/                 → تطبيق Flutter
│   └── web/                    → موقع Next.js
├── services/
│   ├── api-gateway/            → بوابة API (NestJS)
│   ├── auth-service/           → خدمة المصادقة
│   ├── listings-service/       → خدمة الإعلانات
│   ├── search-service/         → خدمة البحث (Elasticsearch)
│   ├── messaging-service/      → خدمة المحادثات (Socket.io + MongoDB)
│   ├── transactions-service/   → خدمة المعاملات
│   ├── identity-service/       → خدمة التحقق من الهوية (Didit)
│   ├── fraud-service/          → خدمة كشف الاحتيال (Python)
│   └── personalization-service/→ خدمة التخصيص (Python)
├── infra/                      → Docker, Kubernetes, CI/CD
└── docs/                       → التوثيق
```

## 🚀 التشغيل المحلي

### المتطلبات

- Node.js >= 20.x
- Flutter SDK >= 3.29.x
- Python >= 3.11
- Docker & Docker Compose

### التشغيل

```bash
# تشغيل جميع الخدمات عبر Docker
npm run docker:up

# تشغيل خدمة محددة للتطوير
npm run dev:gateway
npm run dev:web

# تشغيل تطبيق الجوال
cd apps/mobile && flutter run
```

## 📝 التوثيق

- [مخطط قاعدة البيانات](docs/database-schema.md)
- [البنية المعمارية](docs/architecture.md)
- [سجل التغييرات](docs/CHANGELOG.md)

## 📄 الترخيص

هذا المشروع خاص — جميع الحقوق محفوظة.
