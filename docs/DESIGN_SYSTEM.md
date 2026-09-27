# نظام التصميم — معرض الأشياء

> مصدر واحد للقرارات البصرية، يولّد الويب (Tailwind v4) والجوال (Flutter) معاً، ويرفض أي لون يفشل في معيار التباين.

## 1. المبادئ

1. **عربي أولاً (RTL):** الاتجاهات منطقية دائماً (`ms-/me-`, `ps-/pe-`, `start-/end-`, `text-start`) — لا `ml-/left-` أبداً.
2. **دلالي لا فيزيائي:** اكتب `bg-primary` و`text-fg-muted`، لا `bg-teal-700` و`text-gray-600`. الرمز الدلالي يتبدّل تلقائياً في الوضع الداكن.
3. **مقروء للجميع:** كل زوج نص/خلفية ≥ **4.5:1** (WCAG AA)، أهداف لمس ≥ **44px**، تركيز مرئي موحّد، احترام `prefers-reduced-motion`.
4. **هادئ وموثوق:** سوق بين أفراد يعتمد على الثقة — لون علامة واحد، مساحات سخية، ظلال خفيفة.

## 2. البنية

```
packages/design-tokens/tokens.json   ← المصدر الوحيد (عدّل هنا فقط)
          │  npm run tokens:build   (CI: npm run tokens:check)
          ├─► apps/web/src/styles/tokens.css          (@theme + متغيرات CSS للوضعين)
          └─► apps/mobile/lib/core/theme/app_tokens.dart (AppColors.light/dark, AppSpace, AppRadius…)
```

المولّد **يفشل** إذا: (أ) لم يحقق زوج ألوان مُعلن 4.5:1 في أي وضع، أو (ب) كانت الملفات المولّدة قديمة.

## 3. الرموز

### الألوان الدلالية

| الرمز (ويب) | Flutter | الاستخدام | فاتح | داكن |
|---|---|---|---|---|
| `canvas` | `background` | خلفية الصفحة | gray-50 | #0b1220 |
| `surface` | `surface` | البطاقات والحقول | أبيض | #111a2b |
| `surface-muted` | `surfaceMuted` | خلفيات ثانوية، hover | gray-100 | #1e293b |
| `line` / `line-strong` | `border` / `borderStrong` | الحدود | gray-200/300 | … |
| `fg` / `fg-muted` / `fg-subtle` | `text` / `textMuted` / `textSubtle` | النص الأساسي/الثانوي/التلميح | gray-900/600/500 | … |
| `primary` / `primary-hover` / `on-primary` | نفسها | الإجراء الرئيسي | brand-700 / أبيض | brand-400 / brand-950 |
| `primary-soft` / `on-primary-soft` | نفسها | شارات وخلفيات هادئة | brand-50 / brand-800 | brand-950 / brand-200 |
| `danger` `success` `warning` (+`-soft`) | نفسها | الحالات | … | … |
| `focus-ring` | `focusRing` | حلقة التركيز | brand-500 | brand-400 |

> **لماذا brand-700 وليس brand-600؟** اللون المستخدم سابقاً (`teal-600`) يعطي 3.74:1 مع الأبيض — يفشل AA. `brand-700` يعطي 5.47:1.

سلّم `gray-*` في Tailwind مربوط بمتغيرات تنقلب في الوضع الداكن، لذا الأصناف القديمة (`bg-gray-50`, `text-gray-900`) تعمل في الوضعين أثناء الترحيل.

### المسافات والأشكال

- **المسافات:** شبكة 4px (`1`=4 … `16`=64) — نفس سلّم Tailwind.
- **الزوايا:** `rounded-control` 10px (أزرار/حقول)، `rounded-card` 14px، `rounded-sheet` 20px، `rounded-pill`.
- **الظلال:** `shadow-sm` للبطاقات، `shadow-md` للقوائم المنبثقة، `shadow-lg` للنوافذ.
- **الخط:** Cairo (عربي ولاتيني) مع Inter احتياطياً. أحجام: 12/14/16/18/20/24/30/36، ارتفاع السطر 1.6.
- **الحركة:** 120/200/320ms بمنحنى `ease-standard`.

## 4. المكونات (ويب) — `@/components/ui`

| المكوّن | ضمانات مدمجة |
|---|---|
| `Button` (`primary` `secondary` `ghost` `danger`; `sm` `md` `lg`) | ≥44px، `type="button"` افتراضياً، `loading` يعطّل ويضيف `aria-busy` |
| `Input` | `label` إلزامي ومربوط، `hint`/`error` عبر `aria-describedby`، `aria-invalid`، يعمل مع `register()` |
| `Alert` | `role="alert"` للأخطاء (يُعلن فوراً)، `status` لغيرها |
| `Card`, `Badge`, `Skeleton`, `Spinner` | ألوان دلالية، `Skeleton` مخفي عن قارئ الشاشة |
| `EmptyState` | عنوان + شرح + إجراء تالٍ |
| `ThemeToggle` | يحفظ الاختيار، ونص `themeInitScript` يطبّقه قبل أول رسم (بلا وميض) |

**مرجع التطبيق:** صفحة `/login` أُعيد بناؤها بهذه المكونات.

```tsx
import { Alert, Button, Input } from '@/components/ui';

<Input label="كلمة المرور" type="password" error={errors.password?.message} {...register('password')} />
<Button type="submit" size="lg" fullWidth loading={isSubmitting}>تسجيل الدخول</Button>
```

## 5. Flutter

```dart
import 'package:marad_mobile/core/theme/app_theme.dart';

Text('...', style: TextStyle(color: context.colors.textMuted));   // يتبع الوضع الداكن
const SizedBox(height: AppSpace.s4);
BorderRadius.circular(AppRadius.card);
```

`MaterialApp` يستخدم `lightTheme` و`darkTheme` مع `ThemeMode.system`. الثوابت القديمة (`AppTheme.primaryColor`…) باقية كـ `const` للتوافق، لكنها فاتحة فقط — استبدلها بـ `context.colors` تدريجياً.

## 6. ما نُفّذ وما بقي

**نُفّذ:**
- ترحيل آلي لـ 40 ملف ويب:
  - توحيد 6 ألوان "رئيسية" متضاربة (blue, teal, indigo, emerald, cyan, sky) إلى `brand`، ثم إلى رموز دلالية.
  - `bg-white` → `bg-surface`.
  - 84 اتجاهاً فيزيائياً → منطقي، **مع الحفاظ على الشكل الحالي حرفياً:** في صفحة RTL اليمين = start.
- وضع داكن كامل.
- إصلاح تباين الأزرار الرئيسية.
- إصلاح خط الويب: كان `"Cairo"` كاسم عائلة لا يطابق خط `next/font`.

**بقي** (مرتبط بخطوة نقد التصميم):
- استبدال الأزرار والحقول اليدوية في بقية الصفحات بالمكونات.
- ترحيل 63 لوناً ثابتاً و245 `Colors.*` في Flutter إلى `context.colors`.
- **تضمين خط Cairo في تطبيق الجوال:** `fontFamily: 'Cairo'` مُعلن دون ملف خط في `pubspec.yaml`، فيظهر خط النظام.
- مراجعة اتجاه الأيقونات السهمية في RTL.
