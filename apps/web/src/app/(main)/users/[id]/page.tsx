'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { BadgeCheck, Calendar, Flag, MapPin, Star, User } from 'lucide-react';
import { useUserReviews } from '@/hooks/useUserReviews';
import { useListings } from '@/hooks/useListings';
import { userApi } from '@/lib/api/users';
import { ReportDialog } from '@/components/moderation/ReportDialog';
import { ListingCard } from '@/components/ListingCard/ListingCard';
import { Badge, Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import type { RatingSummary } from '@/lib/api/transactions';

const since = (date?: string) => (date ? formatDistanceToNow(new Date(date), { addSuffix: true, locale: ar }) : null);

function Stars({ value, size = 'h-4 w-4' }: { value: number; size?: string }) {
  return (
    <span className="flex text-warning" aria-label={`${value.toFixed(1)} من 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} aria-hidden className={`${size} ${s <= Math.round(value) ? 'fill-current' : 'text-line-strong'}`} />
      ))}
    </span>
  );
}

function RatingBreakdown({ summary }: { summary: RatingSummary }) {
  const total = summary.total_reviews;
  const rows = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: Number(summary[`rating_${stars}_count` as keyof RatingSummary] ?? 0),
  }));
  return (
    <ul className="flex flex-col gap-2">
      {rows.map(({ stars, count }) => (
        <li key={stars} className="flex items-center gap-2 text-sm text-fg-muted">
          <span className="w-14">{stars} نجوم</span>
          <span className="h-2 flex-1 overflow-hidden rounded-pill bg-surface-muted">
            <span className="block h-full bg-warning" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
          </span>
          <span className="w-8 text-end">{count.toLocaleString('ar')}</span>
        </li>
      ))}
    </ul>
  );
}

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [reportOpen, setReportOpen] = useState(false);

  const { data: user, error: userError, isLoading: userLoading, mutate: retryUser } = useSWR(['/users', id], () => userApi.getUser(id));
  const { reviews, summary, isLoading: reviewsLoading, isError: reviewsError, mutate: retryReviews } = useUserReviews(id, 1, 10);
  const { listings, isLoading: listingsLoading } = useListings({ userId: id });
  const activeListings = listings.filter((l) => l.status === 'active');

  if (userLoading) {
    return (
      <main className="container mx-auto flex flex-col gap-6 px-4 py-8">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  if (userError || !user) {
    const notFound = userError?.response?.status === 404;
    return (
      <main className="container mx-auto px-4 py-16">
        <Card>
          <ErrorState
            title={notFound ? 'هذا الحساب غير موجود' : 'تعذّر تحميل الملف الشخصي'}
            description={notFound ? 'ربما حُذف الحساب أو أن الرابط غير صحيح.' : undefined}
            onRetry={notFound ? undefined : () => retryUser()}
          />
        </Card>
      </main>
    );
  }

  const average = Number(summary?.average_rating ?? 0);
  const joined = since(user.createdAt);

  return (
    <main className="container mx-auto flex flex-col gap-8 px-4 py-8">
      <Card className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start">
        {user.avatar ? (
          <img src={user.avatar} alt="" className="h-24 w-24 shrink-0 rounded-pill object-cover" />
        ) : (
          <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-pill bg-surface-muted text-fg-subtle">
            <User className="h-10 w-10" aria-hidden />
          </span>
        )}
        <div className="flex-1 text-center sm:text-start">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h1 className="text-2xl font-bold text-fg">{user.name || 'مستخدم'}</h1>
            {user.isIdentityVerified && (
              <Badge tone="success">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> هوية موثّقة
              </Badge>
            )}
          </div>
          {user.bio && <p className="mt-2 text-fg-muted">{user.bio}</p>}
          <div className="mt-3 flex flex-wrap justify-center gap-4 text-sm text-fg-muted sm:justify-start">
            {user.location && (
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden /> {user.location}</span>
            )}
            {joined && (
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" aria-hidden /> انضم {joined}</span>
            )}
            {summary && summary.total_reviews > 0 && (
              <span className="flex items-center gap-1">
                <Stars value={average} /> {average.toFixed(1)} ({summary.total_reviews.toLocaleString('ar')} تقييم)
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-medium text-danger hover:bg-danger-soft"
        >
          <Flag className="h-4 w-4" aria-hidden /> الإبلاغ عن الحساب
        </button>
      </Card>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="flex flex-col gap-4 lg:col-span-2" aria-labelledby="listings-heading">
          <h2 id="listings-heading" className="text-lg font-semibold text-fg">
            الإعلانات المنشورة {!listingsLoading && `(${activeListings.length.toLocaleString('ar')})`}
          </h2>
          {listingsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-72" />
              ))}
            </div>
          ) : activeListings.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {activeListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState title="لا توجد إعلانات منشورة حالياً" />
            </Card>
          )}
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="reviews-heading">
          <h2 id="reviews-heading" className="text-lg font-semibold text-fg">التقييمات</h2>
          <Card className="flex flex-col gap-6 p-5">
            {reviewsLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : reviewsError ? (
              <ErrorState title="تعذّر تحميل التقييمات" onRetry={() => retryReviews()} />
            ) : !summary || summary.total_reviews === 0 ? (
              <EmptyState title="لا توجد تقييمات بعد" description="تظهر التقييمات بعد إتمام صفقات مع هذا البائع." />
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <span className="text-4xl font-bold text-fg">{average.toFixed(1)}</span>
                  <div>
                    <Stars value={average} size="h-5 w-5" />
                    <p className="mt-1 text-sm text-fg-muted">من {summary.total_reviews.toLocaleString('ar')} تقييم</p>
                  </div>
                </div>
                <RatingBreakdown summary={summary} />
                <ul className="flex flex-col divide-y divide-line">
                  {reviews.map((review) => (
                    <li key={review.id} className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <Stars value={review.rating} />
                        <span className="text-xs text-fg-subtle">{since(review.created_at)}</span>
                      </div>
                      {review.comment && <p className="text-sm text-fg">{review.comment}</p>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </section>
      </div>

      {reportOpen && <ReportDialog targetType="user" targetId={id} onClose={() => setReportOpen(false)} />}
    </main>
  );
}
