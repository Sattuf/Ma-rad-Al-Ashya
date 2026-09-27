'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ChevronLeft, Handshake, ImageOff } from 'lucide-react';
import { useDealDetails, useTransactions } from '@/hooks/useTransactions';
import { useAuthStore } from '@/lib/store/auth-store';
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { coverImage, formatPrice } from '@/types/listing';
import { dealStatusLabel } from '@/lib/deals';

const TABS = [
  { role: 'buyer', label: 'مشترياتي' },
  { role: 'seller', label: 'مبيعاتي' },
] as const;

export default function DealsPage() {
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [page, setPage] = useState(1);
  const me = useAuthStore((s) => s.user?.id);
  const { transactions: deals, lastPage, isLoading, error, mutate } = useTransactions(role, undefined, page, 10);
  const { listings, people } = useDealDetails(deals, me);

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-fg">صفقاتي</h1>
      <p className="mb-6 text-fg-muted">تتمّ الصفقة عندما يؤكدها البائع ثم المشتري بعد الاستلام.</p>

      <div role="tablist" aria-label="نوع الصفقات" className="mb-6 flex gap-2 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.role}
            role="tab"
            aria-selected={role === t.role}
            onClick={() => {
              setRole(t.role);
              setPage(1);
            }}
            className={cn(
              '-mb-px min-h-11 border-b-2 px-4 text-sm font-medium',
              role === t.role ? 'border-primary text-fg' : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <ErrorState error={error} title="تعذّر تحميل صفقاتك" onRetry={() => mutate()} />
        </Card>
      ) : deals.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Handshake className="h-6 w-6" aria-hidden />}
            title={role === 'buyer' ? 'لم تشترِ شيئاً بعد' : 'لم تبع شيئاً بعد'}
            description={
              role === 'buyer'
                ? 'عندما تضغط «اشترِ الآن» في صفحة إعلان، تظهر الصفقة هنا لتتابعها حتى الاستلام.'
                : 'عندما يطلب مشترٍ أحد إعلاناتك، تظهر الصفقة هنا لتؤكدها.'
            }
            action={
              <Link href={role === 'buyer' ? '/listings' : '/listings/create'} className="inline-flex min-h-11 items-center rounded-control bg-primary px-5 font-semibold text-on-primary hover:bg-primary-hover">
                {role === 'buyer' ? 'تصفّح الإعلانات' : 'أضف إعلاناً'}
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {deals.map((deal) => {
              const listing = listings?.get(deal.listingId);
              const other = people?.get(role === 'buyer' ? deal.sellerId : deal.buyerId);
              const status = dealStatusLabel(deal.status, role);
              const image = listing ? coverImage(listing) : null;
              return (
                <li key={deal.id}>
                  <Link href={`/transactions/${deal.id}`} className="block rounded-card focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
                    <Card className="flex items-center gap-4 p-4 transition-colors hover:border-line-strong">
                      {image ? (
                        <img src={image} alt="" className="h-16 w-16 shrink-0 rounded-control object-cover" />
                      ) : (
                        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-control bg-surface-muted text-fg-subtle">
                          <ImageOff className="h-5 w-5" aria-hidden />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-fg">{listing?.title ?? (listings ? 'إعلان محذوف' : '…')}</p>
                        <p className="text-sm text-fg-muted">
                          {listing && `${formatPrice(listing.price, listing.currency)} · `}
                          {role === 'buyer' ? 'البائع' : 'المشتري'}: {other?.name || '…'} ·{' '}
                          {formatDistanceToNow(new Date(deal.createdAt), { addSuffix: true, locale: ar })}
                        </p>
                      </div>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <ChevronLeft className="h-5 w-5 shrink-0 text-fg-subtle" aria-hidden />
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
          {lastPage > 1 && (
            <nav aria-label="الصفحات" className="mt-6 flex items-center justify-center gap-3">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>السابق</Button>
              <span className="text-sm text-fg-muted">صفحة {page} من {lastPage}</span>
              <Button variant="secondary" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>التالي</Button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
