'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ImagePlus, X } from 'lucide-react';
import { useListingDetail } from '@/hooks/useListings';
import { useCategories } from '@/hooks/useCategories';
import { listingsApi } from '@/lib/api/listings';
import { Alert, Button, Card, ErrorState, Input, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CONDITION_LABELS, type ListingCondition } from '@/types/listing';

const MAX_IMAGES = 10;

const schema = z.object({
  title: z.string().trim().min(5, 'اكتب عنواناً من 5 أحرف على الأقل').max(120, 'العنوان طويل جداً'),
  categoryId: z.string().min(1, 'اختر القسم'),
  price: z
    .string()
    .trim()
    .refine((v) => Number.isFinite(Number(v)) && Number(v) > 0, 'السعر يجب أن يكون رقماً أكبر من صفر'),
  // Optional: listings published before the field have none until the seller picks one.
  condition: z.enum(['new', 'used']).nullish(),
  location: z.string().trim().max(100, 'الموقع طويل جداً (100 حرف كحد أقصى)'),
  description: z.string().trim().min(20, 'صف السلعة في 20 حرفاً على الأقل'),
});
type FormValues = z.infer<typeof schema>;

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { listing, isLoading, error, mutate } = useListingDetail(id);
  const { flat: categories } = useCategories();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);
  const [busyImage, setBusyImage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (listing) {
      reset({
        title: listing.title,
        categoryId: listing.categoryId ?? '',
        price: String(listing.price),
        description: listing.description,
        condition: listing.condition ?? null,
        location: listing.location ?? '',
      });
    }
  }, [listing, reset]);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    setMessage(null);
    try {
      await listingsApi.updateListing(id, {
        title: values.title,
        description: values.description,
        price: Number(values.price),
        categoryId: values.categoryId,
        ...(values.condition && { condition: values.condition }),
        location: values.location.trim(),
      });
      await mutate();
      router.push('/my-listings');
    } catch {
      setMessage({ tone: 'danger', text: 'تعذّر حفظ التعديلات. لم يتغيّر شيء، حاول مجدداً.' });
    } finally {
      setSaving(false);
    }
  };

  const addImages = async (files: FileList | null) => {
    if (!files?.length || !listing) return;
    const room = MAX_IMAGES - listing.images.length;
    setMessage(null);
    for (const file of Array.from(files).slice(0, room)) {
      setBusyImage('upload');
      try {
        await listingsApi.uploadImage(id, file);
      } catch {
        setMessage({ tone: 'danger', text: `تعذّر رفع ${file.name}. تأكد أنها JPG أو PNG وأصغر من 5 ميغابايت.` });
        break;
      }
    }
    setBusyImage(null);
    await mutate();
  };

  const removeImage = async (imageId: string) => {
    setBusyImage(imageId);
    try {
      await listingsApi.deleteImage(id, imageId);
      await mutate();
    } catch {
      setMessage({ tone: 'danger', text: 'تعذّر حذف الصورة، حاول مجدداً.' });
    } finally {
      setBusyImage(null);
    }
  };

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }
  if (error || !listing) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Card>
          <ErrorState error={error} title="تعذّر تحميل الإعلان" onRetry={() => mutate()} />
        </Card>
      </main>
    );
  }

  const images = [...listing.images].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-fg">تعديل الإعلان</h1>
      {message && <Alert tone={message.tone} className="mb-4">{message.text}</Alert>}

      <Card className="mb-6 p-6">
        <h2 className="mb-3 font-semibold text-fg">الصور ({images.length}/{MAX_IMAGES})</h2>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.id} className="relative aspect-square overflow-hidden rounded-control border border-line">
              <img src={img.thumbnailUrl} alt={`صورة ${i + 1}`} className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute bottom-1 start-1 rounded-pill bg-primary px-2 text-xs text-on-primary">الغلاف</span>}
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                disabled={busyImage !== null}
                aria-label={`حذف الصورة ${i + 1}`}
                className="absolute top-1 end-1 inline-flex h-8 w-8 items-center justify-center rounded-pill bg-surface/90 text-fg disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
          {images.length < MAX_IMAGES && (
            <li>
              <label
                className={cn(
                  'flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-control border-2 border-dashed border-line text-fg-muted hover:border-line-strong',
                  busyImage && 'pointer-events-none opacity-60',
                )}
              >
                <ImagePlus className="h-6 w-6" aria-hidden />
                <span className="text-xs">{busyImage === 'upload' ? 'جارٍ الرفع…' : 'إضافة صور'}</span>
                <input type="file" accept="image/jpeg,image/png" multiple className="sr-only" onChange={(e) => addImages(e.target.files)} />
              </label>
            </li>
          )}
        </ul>
      </Card>

      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
          <Input label="العنوان" {...register('title')} error={errors.title?.message} />
          <div className="flex flex-col gap-1">
            <label htmlFor="category" className="text-sm font-medium text-fg">القسم</label>
            <select
              id="category"
              {...register('categoryId')}
              className={cn(
                'min-h-11 rounded-control border bg-surface px-3 text-fg focus:outline-none focus:ring-2 focus:ring-focus-ring',
                errors.categoryId ? 'border-danger' : 'border-line',
              )}
            >
              <option value="" disabled>اختر القسم</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {'  '.repeat(c.depth)}
                  {c.name}
                </option>
              ))}
            </select>
            {errors.categoryId && <p className="text-xs text-danger">{errors.categoryId.message}</p>}
          </div>
          <Input label={`السعر (${listing.currency})`} type="number" inputMode="decimal" min={0} step="0.01" {...register('price')} error={errors.price?.message} />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-fg">حالة السلعة</legend>
            <div className="flex gap-3">
              {(Object.keys(CONDITION_LABELS) as ListingCondition[]).map((value) => (
                <label
                  key={value}
                  className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-control border border-line bg-surface px-4 text-fg has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:font-semibold has-[:checked]:text-on-primary-soft"
                >
                  <input type="radio" value={value} {...register('condition')} className="accent-primary" />
                  {CONDITION_LABELS[value]}
                </label>
              ))}
            </div>
          </fieldset>
          <Input
            label="الموقع (اختياري)"
            placeholder="المدينة - الحي، مثال: دمشق - المزة"
            maxLength={100}
            autoComplete="address-level2"
            {...register('location')}
            error={errors.location?.message}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="description" className="text-sm font-medium text-fg">الوصف</label>
            <textarea
              id="description"
              rows={6}
              {...register('description')}
              className={cn(
                'rounded-control border bg-surface px-4 py-3 text-fg focus:outline-none focus:ring-2 focus:ring-focus-ring',
                errors.description ? 'border-danger' : 'border-line',
              )}
            />
            {errors.description && <p className="text-xs text-danger">{errors.description.message}</p>}
          </div>
          <div className="flex justify-end gap-3 border-t border-line pt-5">
            <Button variant="ghost" onClick={() => router.back()}>إلغاء</Button>
            <Button type="submit" loading={saving} disabled={!isDirty}>حفظ التعديلات</Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
