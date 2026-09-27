'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, ImageOff, Pencil, Plus, Rocket, Trash2 } from 'lucide-react';
import { useMyListings } from '@/hooks/useListings';
import { listingsApi } from '@/lib/api/listings';
import { promotionsApi, type Promotion } from '@/lib/api/promotions';
import { Alert, Badge, Button, Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { coverImage, formatPrice, type Listing } from '@/types/listing';

const STATUS: Record<Listing['status'], { label: string; tone: 'success' | 'neutral' | 'warning' | 'danger' }> = {
  active: { label: 'منشور', tone: 'success' },
  sold: { label: 'تم البيع', tone: 'neutral' },
  expired: { label: 'منتهي', tone: 'warning' },
  deleted: { label: 'محذوف', tone: 'danger' },
};

export default function MyListingsPage() {
  const { listings, isLoading, error, mutate } = useMyListings();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    promotionsApi.getMyPromotions().then(setPromotions).catch(() => setPromotions([]));
  }, [listings.length]);

  const remove = async (id: string) => {
    setBusyId(id);
    setNotice(null);
    try {
      await listingsApi.deleteListing(id);
      await mutate();
    } catch {
      setNotice('تعذّر حذف الإعلان، حاول مجدداً.');
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  };

  const markSold = async (id: string) => {
    setBusyId(id);
    try {
      await listingsApi.updateStatus(id, 'sold');
      await mutate();
    } catch {
      setNotice('تعذّر تحديث حالة الإعلان، حاول مجدداً.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">إعلاناتي</h1>
          <p className="text-fg-muted">تابع إعلاناتك وعدّلها أو علّمها كمباعة.</p>
        </div>
        <Link href="/listings/create" className="inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-4 font-semibold text-on-primary hover:bg-primary-hover">
          <Plus className="h-5 w-5" aria-hidden /> أضف إعلاناً
        </Link>
      </div>

      {notice && <Alert tone="danger" className="mb-4">{notice}</Alert>}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <ErrorState title="تعذّر تحميل إعلاناتك" onRetry={() => mutate()} />
        </Card>
      ) : listings.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Plus className="h-6 w-6" aria-hidden />}
            title="لم تنشر أي إعلان بعد"
            description="صوّر ما لا تحتاجه، واكتب سعراً عادلاً، ودع المشترين يصلون إليك."
            action={
              <Link href="/listings/create" className="inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-5 font-semibold text-on-primary hover:bg-primary-hover">
                أضف إعلانك الأول
              </Link>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {listings.map((listing) => {
            const promoted = promotions.some((p) => p.listingId === listing.id && p.status === 'active');
            const image = coverImage(listing);
            const status = STATUS[listing.status];
            return (
              <li key={listing.id}>
                <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    {image ? (
                      <img src={image} alt="" className="h-20 w-20 shrink-0 rounded-control object-cover" />
                    ) : (
                      <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-control bg-surface-muted text-fg-subtle">
                        <ImageOff className="h-6 w-6" aria-hidden />
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {promoted && <Badge tone="warning">مروَّج</Badge>}
                      </div>
                      <Link href={`/listings/${listing.id}`} className="line-clamp-1 font-semibold text-fg hover:text-primary">
                        {listing.title}
                      </Link>
                      <p className="text-sm text-fg-muted">
                        {formatPrice(listing.price, listing.currency)} · <Eye className="inline h-3.5 w-3.5" aria-hidden /> {listing.viewsCount.toLocaleString('ar')}
                      </p>
                    </div>
                  </div>

                  {confirmId === listing.id ? (
                    <div className="flex flex-wrap items-center gap-2" role="alertdialog" aria-label="تأكيد الحذف">
                      <span className="text-sm text-fg">حذف الإعلان نهائياً؟</span>
                      <Button size="sm" variant="danger" loading={busyId === listing.id} onClick={() => remove(listing.id)}>حذف</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>تراجع</Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {listing.status === 'active' && !promoted && (
                        <Link href={`/listings/${listing.id}/promote`} className="inline-flex min-h-11 items-center gap-1 rounded-control px-3 text-sm font-medium text-primary hover:bg-primary-soft">
                          <Rocket className="h-4 w-4" aria-hidden /> ترويج
                        </Link>
                      )}
                      {listing.status === 'active' && (
                        <Button size="sm" variant="secondary" loading={busyId === listing.id} onClick={() => markSold(listing.id)}>
                          تم البيع
                        </Button>
                      )}
                      <Link href={`/listings/${listing.id}/edit`} aria-label={`تعديل ${listing.title}`} className="inline-flex h-11 w-11 items-center justify-center rounded-control text-fg-muted hover:bg-surface-muted hover:text-fg">
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Link>
                      <button type="button" onClick={() => setConfirmId(listing.id)} aria-label={`حذف ${listing.title}`} className="inline-flex h-11 w-11 items-center justify-center rounded-control text-fg-muted hover:bg-danger-soft hover:text-danger">
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
