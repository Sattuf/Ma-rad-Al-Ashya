# اختبارات الحمل — Load Tests (k6)

الأهداف (المرحلة 2 من `docs/REBUILD_PLAN.md`): **p95 < 300ms** و**أخطاء < 1%** عند 500 طلب/ثانية على تصفح الإعلانات.
كل سيناريو يحدد عتبات (thresholds)، فيفشل `k6` بكود خروج غير صفري إذا لم تتحقق الأهداف.

## التشغيل

```bash
# محلياً بعد docker compose up
k6 run infra/load-tests/listings-browse-load.js
# على بيئة staging
k6 run -e BASE_URL=https://staging.example.com infra/load-tests/search-load.js
```

أو من GitHub Actions: **Actions → Load tests → Run workflow** مع إدخال `base_url`.

> ⚠️ لا تشغّل هذه الاختبارات على الإنتاج. حد الطلبات في البوابة (`RATE_LIMIT_PER_MINUTE`) قد يحتاج رفعاً مؤقتاً على staging،
> وإلا ستقيس اختبارات الحمل رد 429 بدلاً من أداء الخدمة.

## السيناريوهات

| الملف | ماذا يقيس |
|---|---|
| `listings-browse-load.js` | تصفح مجهول: صفحات القوائم (كاش البوابة + الفهرس) وتفاصيل الإعلان، بمعدل وصول ثابت حتى 500 RPS |
| `search-load.js` | البحث عبر Elasticsearch حتى 150 مستخدماً متزامناً |
| `auth-load.js` | أن محاولات الدخول الخاطئة تُرفض بـ 401/429 ولا تُسقط الخدمة (لا 5xx) |
