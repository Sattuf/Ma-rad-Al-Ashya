/**
 * User-facing error copy. One place decides what a person reads when something fails,
 * so the same failure always gets the same words (see docs/UX_COPY.md).
 *
 * Rules:
 * - Say what happened and what to do next; never blame the user for our faults.
 * - Tell "your connection" apart from "our server": the fix is different.
 * - Never show raw server text in English or technical jargon. Arabic messages written
 *   for users by the server are shown as-is; known English ones are translated; anything
 *   else falls back to the screen's own context message.
 */

export type ErrorKind = 'offline' | 'network' | 'timeout' | 'server' | 'rate-limit' | 'unauthorized' | 'forbidden' | 'not-found' | 'too-large' | 'rejected';

interface HttpLikeError {
  code?: string;
  message?: string;
  response?: { status?: number; data?: { message?: unknown; detail?: unknown } };
}

const asHttpError = (err: unknown): HttpLikeError => (err && typeof err === 'object' ? (err as HttpLikeError) : {});

export function errorKind(err: unknown): ErrorKind {
  const e = asHttpError(err);
  const status = e.response?.status;
  if (!status) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
    if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') return 'timeout';
    return 'network';
  }
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 413) return 'too-large';
  if (status === 429) return 'rate-limit';
  if (status >= 500) return 'server';
  return 'rejected';
}

/** Default copy per failure kind: what happened + what to do. */
export const ERROR_COPY: Record<ErrorKind, { title: string; description: string }> = {
  offline: { title: 'لا يوجد اتصال بالإنترنت', description: 'تحقّق من اتصالك بالشبكة، ثم حاول مجدداً.' },
  network: { title: 'تعذّر الوصول إلى الخادم', description: 'قد يكون العطل مؤقتاً من جهتنا. حاول بعد قليل.' },
  timeout: { title: 'استغرق الطلب وقتاً أطول من المعتاد', description: 'قد يكون اتصالك بطيئاً أو الخادم مشغولاً. حاول مجدداً.' },
  server: { title: 'حدث خلل من جهتنا', description: 'المشكلة ليست منك، ونعمل على ذلك. حاول بعد قليل.' },
  'rate-limit': { title: 'محاولات كثيرة في وقت قصير', description: 'انتظر دقيقة، ثم حاول مجدداً.' },
  unauthorized: { title: 'انتهت جلستك', description: 'سجّل الدخول مجدداً للمتابعة.' },
  forbidden: { title: 'لا تملك صلاحية لهذا الإجراء', description: 'إن كنت تظن أن هذا خطأ، تواصل مع الدعم.' },
  'not-found': { title: 'لم نعثر على المطلوب', description: 'ربما حُذف أو تغيّر رابطه.' },
  'too-large': { title: 'الملف أكبر من المسموح', description: 'اختر ملفاً أصغر (حتى 5 ميغابايت للصورة).' },
  rejected: { title: 'تعذّر إتمام الطلب', description: 'راجع البيانات المُدخلة، ثم حاول مجدداً.' },
};

/**
 * English messages the services send for situations a user can actually meet, in the
 * voice of the app. Internal ones (secrets, tokens, payload shapes) are deliberately
 * absent: those fall back to generic copy.
 */
const SERVER_MESSAGES_AR: Record<string, string> = {
  'Listing not found': 'لم نعثر على هذا الإعلان؛ ربما حُذف.',
  'User not found': 'لم نعثر على هذا الحساب.',
  'Transaction not found': 'لم نعثر على هذه الصفقة.',
  'Conversation not found': 'لم نعثر على هذه المحادثة.',
  'Message not found': 'لم نعثر على هذه الرسالة.',
  'Report not found': 'لم نعثر على هذا البلاغ.',
  'You have already reported this item': 'سبق أن أبلغت عن هذا. سيراجعه فريقنا.',
  'You have already reviewed this transaction': 'سبق أن قيّمت هذه الصفقة.',
  'Transaction must be completed to leave a review': 'يمكنك التقييم بعد أن يؤكد الطرفان إتمام الصفقة.',
  'Transaction already initiated for this listing by this buyer': 'لديك طلب شراء قائم لهذا الإعلان. تابعه من «صفقاتي».',
  'Listing is not available for purchase': 'هذا الإعلان لم يعد متاحاً للشراء.',
  'Seller does not own this listing': 'تعذّر بدء الصفقة: البائع لا يملك هذا الإعلان.',
  'Unable to verify listing, please try again': 'تعذّر التحقق من الإعلان الآن. حاول مجدداً.',
  'You are not a participant in this transaction': 'لست طرفاً في هذه الصفقة.',
  'You are not a participant in this conversation': 'لست طرفاً في هذه المحادثة.',
  'You can only delete your own messages': 'يمكنك حذف رسائلك فقط.',
  'Message content is required': 'اكتب رسالتك أولاً.',
  'Maximum 10 images allowed': 'الحد الأقصى 10 صور للإعلان.',
  'Only active listings can be promoted': 'يمكن ترويج الإعلانات المنشورة فقط.',
  'Listing is already promoted': 'هذا الإعلان مروَّج بالفعل.',
  'Not authorized: Only the seller can promote this listing': 'يستطيع صاحب الإعلان فقط ترويجه.',
  'Invalid promotion plan': 'خطة الترويج غير متاحة. اختر خطة أخرى.',
  'Cannot report yourself or your own listing': 'لا يمكنك الإبلاغ عن نفسك أو عن إعلانك.',
  'Not authorized': 'لا تملك صلاحية لهذا الإجراء.',
  'Admin access required': 'هذه الصفحة للمشرفين فقط.',
};

const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

/** The server's message, only if it is safe and meaningful to show to a person. */
function readableServerMessage(err: unknown): string | null {
  const data = asHttpError(err).response?.data;
  const raw = data?.message ?? data?.detail;
  const messages = (Array.isArray(raw) ? raw : [raw]).filter((m): m is string => typeof m === 'string' && m.trim() !== '');
  const shown = messages.map((m) => (hasArabic(m) ? m : SERVER_MESSAGES_AR[m.trim()])).filter(Boolean) as string[];
  return shown.length ? shown.join('، ') : null;
}

/**
 * One sentence for inline errors (alerts under a form, toasts).
 * @param fallback what this screen was trying to do, e.g. "تعذّر نشر الإعلان."
 */
export function errorMessage(err: unknown, fallback: string): string {
  const kind = errorKind(err);
  if (kind === 'rejected' || kind === 'not-found' || kind === 'forbidden') {
    return readableServerMessage(err) ?? (kind === 'rejected' ? fallback : ERROR_COPY[kind].title + '.');
  }
  // Auth-specific Arabic messages (wrong password, suspended) arrive as 401 too.
  if (kind === 'unauthorized') return readableServerMessage(err) ?? `${ERROR_COPY.unauthorized.title}. ${ERROR_COPY.unauthorized.description}`;
  const copy = ERROR_COPY[kind];
  return `${copy.title}. ${copy.description}`;
}
