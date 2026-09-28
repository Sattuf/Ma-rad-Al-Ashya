'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { RefreshCw } from 'lucide-react';
import { adminDashboardApi, type ModerationStats } from '@/lib/api/admin-dashboard';
import { listingsApi } from '@/lib/api/listings';
import { userApi } from '@/lib/api/users';
import { Button, ErrorState, Skeleton } from '@/components/ui';
import { BarList, ChartCard, StatTile, TrendChart, TrendTable, type TrendSeries } from '@/components/admin/charts';
import { fmt } from '@/components/admin/format';

// Server caches are 30–60s; refreshing faster only re-reads the same numbers.
const SWR_OPTIONS = { refreshInterval: 60_000, revalidateOnFocus: false, keepPreviousData: true };

const REASONS: Record<string, string> = {
  spam: 'رسائل مزعجة',
  fake: 'إعلان مزيّف',
  scam: 'احتيال',
  inappropriate: 'محتوى غير لائق',
  offensive: 'مسيء',
  wrong_category: 'قسم خاطئ',
  other: 'أخرى',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-subtle">{title}</h2>
      {children}
    </section>
  );
}

function Failed({ what, error, retry }: { what: string; error: unknown; retry: () => void }) {
  return (
    <div className="rounded-card border border-line bg-surface">
      <ErrorState error={error} title={`تعذّر تحميل ${what}`} onRetry={retry} />
    </div>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="text-sm text-fg-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-fg">{value}</p>
      {hint && <p className="mt-1 text-xs text-fg-subtle">{hint}</p>}
    </div>
  );
}

/** Reported ids → readable names. Deleted or sold listings are not returned by the public list. */
function useReportedNames(moderation?: ModerationStats) {
  const listingIds = moderation?.topReportedListings.map((l) => l.id) ?? [];
  const userIds = moderation?.topReportedUsers.map((u) => u.id) ?? [];
  const { data: listings } = useSWR(listingIds.length ? ['admin-reported-listings', ...listingIds] : null, async () => {
    const page = await listingsApi.getListings({ ids: listingIds.join(','), limit: listingIds.length });
    return new Map(page.data.map((l) => [l.id, l.title]));
  });
  const { data: users } = useSWR(userIds.length ? ['admin-reported-users', ...userIds] : null, async () => {
    const found = await Promise.allSettled(userIds.map((id) => userApi.getUser(id)));
    return new Map(found.flatMap((r, i) => (r.status === 'fulfilled' ? [[userIds[i], r.value.name || 'مستخدم'] as const] : [])));
  });
  return { listings, users };
}

export default function AdminDashboardPage() {
  const moderation = useSWR('admin-stats-moderation', adminDashboardApi.moderation, SWR_OPTIONS);
  const users = useSWR('admin-stats-users', adminDashboardApi.users, SWR_OPTIONS);
  const listings = useSWR('admin-stats-listings', adminDashboardApi.listings, SWR_OPTIONS);
  const deals = useSWR('admin-stats-transactions', adminDashboardApi.transactions, SWR_OPTIONS);
  const fraud = useSWR('admin-stats-fraud', adminDashboardApi.fraud, SWR_OPTIONS);
  const names = useReportedNames(moderation.data);

  const all = [moderation, users, listings, deals, fraud];
  const refreshing = all.some((s) => s.isValidating);
  const refresh = () => all.forEach((s) => s.mutate());

  const m = moderation.data;
  const reportSeries: TrendSeries[] | null = m
    ? [
        { key: 'created', label: 'بلاغات واردة', color: 'chart1', data: m.createdDaily },
        { key: 'handled', label: 'بلاغات عولجت', color: 'chart2', data: m.handledDaily },
      ]
    : null;
  const queueIsOld = (m?.oldestPendingHours ?? 0) > 24;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">لوحة التحكم</h1>
          <p className="text-fg-muted">آخر 30 يوماً، بتوقيت UTC. تتحدّث الأرقام كل دقيقة.</p>
        </div>
        <Button variant="secondary" onClick={refresh} loading={refreshing}>
          <RefreshCw className="h-4 w-4" aria-hidden /> تحديث
        </Button>
      </header>

      {/* KPI row: the queue that needs action first, then growth. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {m ? (
          <StatTile
            label="بلاغات بانتظار المراجعة"
            value={m.pendingReports}
            href="/admin/reports?status=pending"
            tone={queueIsOld ? 'attention' : 'default'}
            footnote={
              m.oldestPendingHours != null ? (
                <span className={queueIsOld ? 'font-semibold text-warning' : undefined}>
                  {queueIsOld && '⚠ '}أقدمها منذ {fmt.hours(m.oldestPendingHours)}
                </span>
              ) : (
                'لا شيء بانتظارك'
              )
            }
          />
        ) : moderation.error ? (
          <Failed what="البلاغات" error={moderation.error} retry={() => moderation.mutate()} />
        ) : (
          <Skeleton className="h-36" />
        )}

        {users.data ? (
          <StatTile label="مستخدمون جدد · 7 أيام" value={users.data.signupsLast7Days} previous={users.data.signupsPrevious7Days} trend={users.data.signupsDaily} />
        ) : users.error ? (
          <Failed what="المستخدمين" error={users.error} retry={() => users.mutate()} />
        ) : (
          <Skeleton className="h-36" />
        )}

        {listings.data ? (
          <StatTile
            label="إعلانات جديدة · 7 أيام"
            value={listings.data.listings.createdLast7Days}
            previous={listings.data.listings.createdPrevious7Days}
            trend={listings.data.listings.createdDaily}
          />
        ) : listings.error ? (
          <Failed what="الإعلانات" error={listings.error} retry={() => listings.mutate()} />
        ) : (
          <Skeleton className="h-36" />
        )}

        {deals.data ? (
          <StatTile label="صفقات مكتملة · 7 أيام" value={deals.data.completedLast7Days} previous={deals.data.completedPrevious7Days} trend={deals.data.completedDaily} />
        ) : deals.error ? (
          <Failed what="الصفقات" error={deals.error} retry={() => deals.mutate()} />
        ) : (
          <Skeleton className="h-36" />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {reportSeries ? (
            <ChartCard
              title="البلاغات: الواردة مقابل المعالَجة"
              subtitle={`يومياً، آخر 30 يوماً (اليوم الأخير لم يكتمل بعد)${m?.avgReviewHours30d != null ? ` · متوسط زمن المراجعة ${fmt.hours(m.avgReviewHours30d)}` : ''}`}
              table={<TrendTable series={reportSeries} />}
            >
              <TrendChart series={reportSeries} />
            </ChartCard>
          ) : moderation.error ? (
            <Failed what="اتجاه البلاغات" error={moderation.error} retry={() => moderation.mutate()} />
          ) : (
            <Skeleton className="h-80" />
          )}
        </div>
        <div className="lg:col-span-2">
          {listings.data ? (
            <ChartCard
              title="الأقسام الأكثر نشاطاً"
              subtitle="عدد الإعلانات المنشورة الآن"
              table={
                <table className="w-full text-sm">
                  <thead className="text-fg-muted">
                    <tr>
                      <th scope="col" className="py-2 text-start font-medium">القسم</th>
                      <th scope="col" className="py-2 text-end font-medium">إعلانات منشورة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line tabular-nums">
                    {listings.data.topCategories.map((c) => (
                      <tr key={c.id}>
                        <th scope="row" className="py-1.5 text-start font-normal text-fg">{c.name}</th>
                        <td className="py-1.5 text-end text-fg">{fmt.int(c.activeListings)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              {listings.data.topCategories.length ? (
                <BarList
                  valueLabel="الإعلانات المنشورة"
                  items={listings.data.topCategories.map((c) => ({ id: c.id, label: c.name, value: c.activeListings, href: `/listings?categoryId=${c.id}` }))}
                />
              ) : (
                <p className="py-8 text-center text-sm text-fg-muted">لا توجد إعلانات منشورة بعد.</p>
              )}
            </ChartCard>
          ) : listings.error ? (
            <Failed what="الأقسام" error={listings.error} retry={() => listings.mutate()} />
          ) : (
            <Skeleton className="h-80" />
          )}
        </div>
      </div>

      <Section title="السوق">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {listings.data && (
            <>
              <Fact label="إعلانات منشورة" value={fmt.compact(listings.data.listings.active)} hint={`${fmt.int(listings.data.listings.sold)} مباعة · ${fmt.int(listings.data.listings.expired)} منتهية`} />
              <Fact
                label="إيراد الترويج · 30 يوماً"
                value={fmt.money(listings.data.promotions.revenueLast30Days, listings.data.promotions.currency)}
                hint={`${fmt.int(listings.data.promotions.paidLast30Days)} عملية دفع · ${fmt.int(listings.data.promotions.active)} ترويج نشط`}
              />
            </>
          )}
          {deals.data && (
            <>
              <Fact
                label="نسبة إتمام الصفقات"
                value={deals.data.completionRate == null ? '—' : fmt.percent(deals.data.completionRate)}
                hint="من الصفقات التي بدأت وانتهت خلال 30 يوماً"
              />
              <Fact label="صفقات مفتوحة" value={fmt.int(deals.data.openDeals)} hint="بانتظار تأكيد أحد الطرفين" />
              <Fact
                label="متوسط التقييم · 30 يوماً"
                value={deals.data.averageRatingLast30Days == null ? '—' : `${fmt.decimal(deals.data.averageRatingLast30Days)} من 5`}
                hint={`${fmt.int(deals.data.reviewsLast30Days)} تقييم`}
              />
            </>
          )}
          {users.data && (
            <Fact
              label="هويات موثّقة"
              value={users.data.totalUsers ? fmt.percent(users.data.identityVerified / users.data.totalUsers) : '—'}
              hint={`${fmt.int(users.data.identityVerified)} من ${fmt.int(users.data.totalUsers)} مستخدم`}
            />
          )}
        </div>
      </Section>

      <Section title="الثقة والأمان">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-card border border-line bg-surface p-5">
            <h3 className="mb-3 font-semibold text-fg">الإعلانات الأكثر إبلاغاً</h3>
            {m?.topReportedListings.length ? (
              <ol className="flex flex-col divide-y divide-line">
                {m.topReportedListings.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/listings/${r.id}`} className="min-w-0 truncate text-sm text-fg hover:text-primary">
                      {names.listings?.get(r.id) ?? (names.listings ? 'إعلان محذوف أو مباع' : '…')}
                    </Link>
                    <span className="shrink-0 text-sm text-fg-muted tabular-nums">{fmt.int(r.pending)} معلّق</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-fg-muted">{m ? 'لا توجد بلاغات معلّقة على إعلانات.' : '…'}</p>
            )}
          </div>
          <div className="rounded-card border border-line bg-surface p-5">
            <h3 className="mb-3 font-semibold text-fg">الحسابات الأكثر إبلاغاً</h3>
            {m?.topReportedUsers.length ? (
              <ol className="flex flex-col divide-y divide-line">
                {m.topReportedUsers.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/admin/fraud/${r.id}`} className="min-w-0 truncate text-sm text-fg hover:text-primary">
                      {names.users?.get(r.id) ?? (names.users ? 'حساب غير متاح' : '…')}
                    </Link>
                    <span className="shrink-0 text-sm text-fg-muted tabular-nums">{fmt.int(r.pending)} معلّق</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-fg-muted">{m ? 'لا توجد بلاغات معلّقة على حسابات.' : '…'}</p>
            )}
          </div>
          <div className="flex flex-col gap-4">
            {fraud.data ? (
              <Link href="/admin/fraud" className="block rounded-card border border-line bg-surface p-5 hover:border-line-strong">
                <p className="text-sm text-fg-muted">حسابات عالية الخطورة · 7 أيام</p>
                <p className="mt-1 text-3xl font-semibold text-fg">{fmt.int(fraud.data.highRiskUsers7d)}</p>
                <p className="mt-1 text-xs text-fg-subtle">{fmt.int(fraud.data.highRiskSignals7d)} إشارة بدرجة خطورة 0٫7 فأعلى</p>
              </Link>
            ) : fraud.error ? (
              <Failed what="مؤشرات الاحتيال" error={fraud.error} retry={() => fraud.mutate()} />
            ) : (
              <Skeleton className="h-28" />
            )}
            {m && m.reasons30d.length > 0 && (
              <div className="rounded-card border border-line bg-surface p-5">
                <h3 className="mb-3 font-semibold text-fg">أسباب البلاغات · 30 يوماً</h3>
                <BarList valueLabel="البلاغات" items={m.reasons30d.map((r) => ({ id: r.reason, label: REASONS[r.reason] ?? r.reason, value: r.count }))} />
              </div>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
