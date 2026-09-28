'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { Check, ImagePlus, X } from 'lucide-react';
import { listingsApi } from '@/lib/api/listings';
import { useCategories } from '@/hooks/useCategories';
import { Alert, Button, Card, Input } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/types/listing';
import { errorMessage } from '@/lib/errors';

// Mirrors listings-service limits (CreateListingDto, image upload pipe).
const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const schema = z.object({
  title: z.string().trim().min(5, 'اكتب عنواناً من 5 أحرف على الأقل').max(120, 'العنوان طويل جداً (120 حرفاً كحد أقصى)'),
  categoryId: z.string().min(1, 'اختر القسم المناسب'),
  price: z
    .string()
    .trim()
    .min(1, 'أدخل السعر')
    .refine((v) => Number.isFinite(Number(v)) && Number(v) > 0, 'السعر يجب أن يكون رقماً أكبر من صفر'),
  description: z.string().trim().min(20, 'صف السلعة في 20 حرفاً على الأقل: الحالة، العمر، سبب البيع'),
});
type FormValues = z.infer<typeof schema>;

type Photo = { id: string; file: File; preview: string };
type Phase = { kind: 'idle' } | { kind: 'publishing'; step: string } | { kind: 'error'; message: string; listingId?: string };

const STEPS = ['التفاصيل', 'الصور', 'المراجعة والنشر'] as const;

export default function CreateListingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const { flat: categories, error: categoriesError, retry: retryCategories } = useCategories();

  const {
    register,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onTouched' });

  // Free object URLs when photos change or the page unmounts.
  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.preview)), [photos]);

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      setPhotoError(null);
      if (rejected.length) {
        const tooBig = rejected.some((r) => r.errors.some((e) => e.code === 'file-too-large'));
        setPhotoError(tooBig ? 'بعض الصور أكبر من 5 ميغابايت ولم تُضف.' : 'نقبل صور JPG وPNG فقط.');
      }
      setPhotos((current) => {
        const room = MAX_IMAGES - current.length;
        if (accepted.length > room) setPhotoError(`الحد الأقصى ${MAX_IMAGES} صور.`);
        return [
          ...current,
          ...accepted.slice(0, room).map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) })),
        ];
      });
    },
    [],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] },
    maxSize: MAX_IMAGE_BYTES,
    disabled: photos.length >= MAX_IMAGES || phase.kind === 'publishing',
  });

  const next = async () => {
    if (step === 0 && !(await trigger())) return;
    if (step === 1 && photos.length === 0) {
      setPhotoError('أضف صورة واحدة على الأقل؛ الإعلانات المصوّرة تُباع أسرع.');
      return;
    }
    setStep((s) => s + 1);
  };

  const publish = async () => {
    const values = getValues();
    let listingId: string | undefined;
    try {
      setPhase({ kind: 'publishing', step: 'جارٍ إنشاء الإعلان…' });
      const listing = await listingsApi.createListing({
        title: values.title.trim(),
        description: values.description.trim(),
        price: Number(values.price),
        categoryId: values.categoryId,
      });
      listingId = listing.id;

      for (const [i, photo] of photos.entries()) {
        setPhase({ kind: 'publishing', step: `جارٍ رفع الصورة ${i + 1} من ${photos.length}…` });
        await listingsApi.uploadImage(listing.id, photo.file);
      }
      router.push(`/listings/${listing.id}`);
    } catch (err) {
      setPhase({
        kind: 'error',
        listingId,
        message: listingId
          ? `نُشر الإعلان، لكن تعذّر رفع بعض الصور (${errorMessage(err, 'رُفض الملف')}) يمكنك إضافتها من صفحة تعديل الإعلان.`
          : errorMessage(err, 'تعذّر نشر الإعلان. لم يُحفظ شيء؛ راجع البيانات وحاول مجدداً.'),
      });
    }
  };

  const values = getValues();
  const category = categories.find((c) => c.id === values.categoryId);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-fg">أضف إعلاناً جديداً</h1>

      <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="خطوات إضافة الإعلان">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? 'step' : undefined} className="flex flex-col gap-2">
            <span className={cn('h-1.5 rounded-pill', i <= step ? 'bg-primary' : 'bg-surface-muted')} />
            <span className={cn('flex items-center gap-1 text-sm', i === step ? 'font-semibold text-fg' : 'text-fg-muted')}>
              {i < step && <Check className="h-4 w-4 text-primary" aria-hidden />}
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      <Card className="p-6">
        {step === 0 && (
          <div className="flex flex-col gap-5">
            <Input label="العنوان" placeholder="مثال: آيفون 15 برو 256GB بحالة ممتازة" {...register('title')} error={errors.title?.message} />

            <div className="flex flex-col gap-1">
              <label htmlFor="category" className="text-sm font-medium text-fg">القسم</label>
              <select
                id="category"
                {...register('categoryId')}
                aria-invalid={errors.categoryId ? true : undefined}
                aria-describedby={errors.categoryId ? 'category-error' : undefined}
                className={cn(
                  'min-h-11 rounded-control border bg-surface px-3 text-fg focus:outline-none focus:ring-2 focus:ring-focus-ring',
                  errors.categoryId ? 'border-danger' : 'border-line',
                )}
                defaultValue=""
              >
                <option value="" disabled>اختر القسم</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {'  '.repeat(c.depth)}
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && <p id="category-error" className="text-xs text-danger">{errors.categoryId.message}</p>}
              {categoriesError && (
                <button type="button" onClick={retryCategories} className="self-start text-xs text-primary underline">
                  تعذّر تحميل الأقسام — إعادة المحاولة
                </button>
              )}
            </div>

            <Input label="السعر (دولار أمريكي)" type="number" inputMode="decimal" min={0} step="0.01" {...register('price')} error={errors.price?.message} />

            <div className="flex flex-col gap-1">
              <label htmlFor="description" className="text-sm font-medium text-fg">الوصف</label>
              <textarea
                id="description"
                rows={6}
                {...register('description')}
                aria-invalid={errors.description ? true : undefined}
                aria-describedby="description-hint"
                placeholder="الحالة، مدة الاستعمال، الملحقات المرفقة، وسبب البيع."
                className={cn(
                  'rounded-control border bg-surface px-4 py-3 text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-focus-ring',
                  errors.description ? 'border-danger' : 'border-line',
                )}
              />
              <p id="description-hint" className={cn('text-xs', errors.description ? 'text-danger' : 'text-fg-muted')}>
                {errors.description?.message ?? 'الوصف الواضح يقلّل الأسئلة ويزيد الثقة.'}
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div
              {...getRootProps()}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed p-8 text-center transition-colors',
                isDragActive ? 'border-primary bg-primary-soft' : 'border-line hover:border-line-strong',
              )}
            >
              <input {...getInputProps()} aria-label="اختر صور الإعلان" />
              <ImagePlus className="h-8 w-8 text-fg-muted" aria-hidden />
              <p className="font-medium text-fg">اسحب الصور هنا أو اضغط للاختيار</p>
              <p className="text-sm text-fg-muted">حتى {MAX_IMAGES} صور، JPG أو PNG، بحد أقصى 5 ميغابايت للصورة. الأولى هي صورة الغلاف.</p>
            </div>
            {photoError && <Alert tone="warning">{photoError}</Alert>}
            {photos.length > 0 && (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-label="الصور المختارة">
                {photos.map((p, i) => (
                  <li key={p.id} className="relative aspect-square overflow-hidden rounded-control border border-line">
                    <img src={p.preview} alt={`صورة ${i + 1}`} className="h-full w-full object-cover" />
                    {i === 0 && <span className="absolute bottom-1 start-1 rounded-pill bg-primary px-2 text-xs text-on-primary">الغلاف</span>}
                    <button
                      type="button"
                      onClick={() => setPhotos((all) => all.filter((x) => x.id !== p.id))}
                      aria-label={`حذف الصورة ${i + 1}`}
                      className="absolute top-1 end-1 inline-flex h-8 w-8 items-center justify-center rounded-pill bg-surface/90 text-fg"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              {photos[0] && <img src={photos[0].preview} alt="" className="h-24 w-24 shrink-0 rounded-control object-cover" />}
              <div className="min-w-0">
                <p className="text-xs text-fg-subtle">{category?.name}</p>
                <h2 className="font-semibold text-fg">{values.title}</h2>
                <p className="text-lg font-bold text-primary">{formatPrice(values.price ?? '0', 'USD')}</p>
              </div>
            </div>
            <p className="whitespace-pre-line text-sm text-fg-muted">{values.description}</p>
            <p className="text-sm text-fg-muted">{photos.length} صورة</p>
            {phase.kind === 'publishing' && <Alert tone="info">{phase.step}</Alert>}
            {phase.kind === 'error' && (
              <Alert tone="danger">
                {phase.message}
                {phase.listingId && (
                  <button type="button" className="ms-2 font-semibold underline" onClick={() => router.push(`/listings/${phase.listingId}/edit`)}>
                    تعديل الإعلان
                  </button>
                )}
              </Alert>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-6">
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || phase.kind === 'publishing'}>
            السابق
          </Button>
          {step < 2 ? (
            <Button onClick={next}>التالي</Button>
          ) : (
            <Button onClick={publish} loading={phase.kind === 'publishing'} disabled={phase.kind === 'error' && !!phase.listingId}>
              نشر الإعلان
            </Button>
          )}
        </div>
      </Card>
    </main>
  );
}
