# تشغيل التطبيق وتجربته على هاتف Android

> الخادم يعمل على حاسوبك عبر Docker، والتطبيق على هاتفك. يتصلان عبر شبكة Wi-Fi نفسها.

## المتطلبات

- Docker وDocker Compose على الحاسوب.
- Flutter 3.38 (`flutter --version`) مع Android SDK (يأتي مع Android Studio).
- هاتف Android مفعّل فيه **وضع المطوّر** و**تصحيح USB**:
  الإعدادات ← حول الهاتف ← اضغط «رقم الإصدار» 7 مرات، ثم خيارات المطوّر ← تصحيح USB.
- الحاسوب والهاتف على **شبكة Wi-Fi نفسها**.

## 1. اعرف عنوان حاسوبك على الشبكة

| النظام | الأمر | ابحث عن |
|---|---|---|
| Windows | `ipconfig` | IPv4 Address، مثل `192.168.1.20` |
| macOS | `ipconfig getifaddr en0` | |
| Linux | `hostname -I` | أول عنوان |

في الخطوات التالية، ضع عنوانك مكان `192.168.1.20`.

## 2. شغّل الخادم

```bash
cp infra/.env.example infra/.env
```

في `infra/.env`:
- املأ الأسرار. ولِّد كلاً منها بـ `openssl rand -base64 48`: `JWT_ACCESS_SECRET` و`JWT_REFRESH_SECRET` (قيمة مختلفة) و`INTERNAL_SECRET` و`DIDIT_WEBHOOK_SECRET` و`METRICS_TOKEN` و`GRAFANA_ADMIN_PASSWORD`.
- أضف سطرين للتجربة على الهاتف:

```env
DEVICE_BIND=0.0.0.0
PUBLIC_API_URL=http://192.168.1.20:3000/api/v1
```

- `DEVICE_BIND` يفتح البوابة (3000) والمحادثات (3004) على الشبكة. استخدمه على شبكة موثوقة فقط.
- `PUBLIC_API_URL` يجعل روابط الصور المرفوعة قابلة للفتح من الهاتف.

ثم شغّل الخادم:

```bash
docker compose -f infra/docker-compose.yml up -d --build --remove-orphans
# لتشغيل البحث المرتّب أيضاً (Elasticsearch):
#   docker compose -f infra/docker-compose.yml --profile search up -d --build --remove-orphans
```

- خدمة `migrate` تنشئ جداول Postgres تلقائياً قبل بقية الخدمات.
- `--remove-orphans` يحذف حاوية MongoDB القديمة إن وُجدت. لحذف بياناتها أيضاً: `docker volume rm marad-mongodb-data`.

**جدار الحماية:** اسمح بالمنفذين 3000 و3004 على الحاسوب. على Windows يظهر سؤال عند أول تشغيل: اختر «Private networks».

**تحقق من الخادم (من الحاسوب):** شغّل الرحلة الكاملة الآلية:

```bash
npm install          # مرة واحدة (في جذر المستودع)
node scripts/e2e-smoke.mjs
```

تسجّل مستخدمَين، وتنشر إعلاناً بصورة، ثم تجرّب المفضلة، والمحادثة الفورية (غير المقروء، والقراءة، وحذف رسالة، وصورة في المحادثة، والحظر)، والصفقة حتى التقييم. يجب أن تنتهي بـ `All … checks passed`. إن فشل فحص، تعرف أي خدمة تعطلت قبل أن تفتح التطبيق.

**تحقق من الهاتف:** افتح متصفح الهاتف على `http://192.168.1.20:3000/health`. يجب أن ترى رداً بصيغة JSON. إن لم يفتح، فالمشكلة في الشبكة أو جدار الحماية، لا في التطبيق.

## 3. شغّل التطبيق على الهاتف

صِل الهاتف بـ USB ووافق على «السماح بتصحيح USB»، ثم:

```bash
cd apps/mobile
cp .env.example .env        # مرة واحدة (مفتاح Stripe اختياري؛ فارغ = الدفع معطّل)
flutter pub get
flutter devices             # يجب أن يظهر هاتفك
flutter run --dart-define=SERVER_HOST=192.168.1.20
```

**أو** ابنِ ملف APK وثبّته يدوياً:

```bash
flutter build apk --debug --dart-define=SERVER_HOST=192.168.1.20
# الملف: build/app/outputs/flutter-apk/app-debug.apk ← انقله إلى الهاتف وثبّته
```

استخدم نسخة **debug**: هي وحدها تقبل الاتصال بخادم التطوير عبر `http`. نسخة الإصدار (release) تتصل عبر `https` فقط، وتحتاج `--dart-define=API_URL=https://…` و`SOCKET_URL`.

## 4. جرّب

1. **حساب جديد:** سجّل بالبريد وكلمة المرور، فلا تحتاج SMS.
2. **أضف إعلاناً بصورة،** ثم تأكد أن الصورة تظهر.
3. **المحادثات:** من حساب ثانٍ، عبر الويب على `http://localhost:3100` أو هاتف آخر، راسل البائع. تحقق من:
   - وصول الرسالة فوراً.
   - عدّاد غير المقروء.
   - علامتي ✓✓ بعد القراءة.
   - عودة المحادثة بعد قطع الإنترنت وإعادته.
4. البحث، والمفضلة، والصفقة من البداية إلى التقييم.

## مشاكل شائعة

| العرض | السبب والحل |
|---|---|
| «تحقّق من اتصالك» في كل شاشة | `SERVER_HOST` خطأ، أو المنفذ 3000 محجوب، أو الهاتف على شبكة أخرى. جرّب `/health` من متصفح الهاتف |
| الواجهة تعمل والمحادثة لا تصل فوراً | المنفذ 3004 محجوب في جدار الحماية، أو `DEVICE_BIND` غير مضبوط |
| الصور لا تظهر | `PUBLIC_API_URL` غير مضبوط أو فيه `localhost`. عدّله ثم أعد التشغيل بـ `docker compose … up -d` |
| `Cleartext HTTP traffic not permitted` | تستخدم نسخة release. استخدم `flutter run` أو `--debug` |
| `flutter devices` لا يرى الهاتف | فعّل تصحيح USB، واختر «نقل الملفات» في إشعار USB، ووافق على بصمة الحاسوب |
| تغيّر عنوان الحاسوب (شبكة أخرى) | حدّث `PUBLIC_API_URL` وأعد `flutter run` بالعنوان الجديد |
