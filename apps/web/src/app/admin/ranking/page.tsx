'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { MousePointerClick, Search, Trophy } from 'lucide-react';
import { compareVariants, rankingApi, type VariantStats } from '@/lib/api/ranking';
import { listingsApi } from '@/lib/api/listings';
import { Card, ErrorState, Skeleton } from '@/components/ui';
import { BarList } from '@/components/admin/charts';
import { fmt } from '@/components/admin/format';
import { cn } from '@/lib/cn';

const pct1 = new Intl.NumberFormat('ar', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

function VariantCard({ name, description, stats, isWinner }: { name: string; description: string; stats: VariantStats; isWinner: boolean }) {
  return (
    <Card className={cn('relative p-5', isWinner && 'border-success')}>
      {isWinner && (
        <span className="absolute end-4 top-4 inline-flex items-center gap-1 rounded-pill bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">
          <Trophy className="h-3.5 w-3.5" aria-hidden /> الأفضل (فرق دالّ إحصائياً)
        </span>
      )}
      <h2 className="font-semibold text-fg">{name}</h2>
      <p className="mb-4 text-sm text-fg-muted">{description}</p>
      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="flex items-center gap-1 text-sm text-fg-muted"><Search className="h-3.5 w-3.5" aria-hidden /> عمليات بحث</dt>
          <dd className="text-xl font-semibold text-fg">{fmt.compact(stats.searches)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-sm text-fg-muted"><MousePointerClick className="h-3.5 w-3.5" aria-hidden /> نقرات</dt>
          <dd className="text-xl font-semibold text-fg">{fmt.compact(stats.clicks)}</dd>
        </div>
        <div>
          <dt className="text-sm text-fg-muted">نسبة النقر</dt>
          <dd className="text-xl font-semibold text-fg">{pct1.format(stats.ctr)}</dd>
        </div>
      </dl>
    </Card>
  );
}

export default function RankingDashboard() {
  const { data, error, isLoading, mutate } = useSWR('admin-ranking-stats', rankingApi.getRankingStats, { revalidateOnFocus: false });
  const ids = data?.topClicked.map((l) => l.id) ?? [];
  const { data: titles } = useSWR(ids.length ? ['admin-ranking-titles', ...ids] : null, async () => {
    const page = await listingsApi.getListings({ ids: ids.join(','), limit: ids.length });
    return new Map(page.data.map((l) => [l.id, l.title]));
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <Card>
        <ErrorState error={error} title="تعذّر تحميل إحصائيات الترتيب" onRetry={() => mutate()} />
      </Card>
    );
  }

  const verdict = compareVariants(data.variants.A, data.variants.B);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold text-fg">تجربة ترتيب نتائج البحث (A/B)</h1>
        <p className="text-fg-muted">
          يُوزَّع الباحثون عشوائياً على خوارزميتين. النقرات عن آخر 30 يوماً؛ عمليات البحث منذ بدء التجربة.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <VariantCard name="A · الترتيب الذكي" description="يدمج الصلة بالبحث مع التفاعل والجودة والترويج." stats={data.variants.A} isWinner={verdict.winner === 'A'} />
        <VariantCard name="B · الأحدث أولاً" description="ترتيب زمني: الأحدث في الأعلى." stats={data.variants.B} isWinner={verdict.winner === 'B'} />
      </div>

      <p role="status" className="rounded-card border border-line bg-surface p-4 text-sm text-fg">
        {verdict.reason === 'insufficient-data'
          ? 'لا يمكن الحكم بعد: نحتاج 100 عملية بحث على الأقل لكل خوارزمية قبل مقارنة نسبتي النقر.'
          : verdict.reason === 'not-significant'
            ? 'الفرق بين الخوارزميتين حتى الآن قد يكون صدفة (دون مستوى ثقة 95%). استمر في التجربة قبل اعتماد أي منهما.'
            : `الخوارزمية ${verdict.winner} أفضل بفرق دالّ إحصائياً (ثقة 95% فأكثر).`}
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-1 font-semibold text-fg">الإعلانات الأكثر نقراً من نتائج البحث</h2>
          <p className="mb-4 text-sm text-fg-muted">آخر 30 يوماً</p>
          {data.topClicked.length ? (
            <BarList
              valueLabel="النقرات"
              items={data.topClicked.map((l) => ({
                id: l.id,
                label: titles?.get(l.id) ?? (titles ? 'إعلان غير منشور حالياً' : '…'),
                value: l.clicks,
                href: `/listings/${l.id}`,
              }))}
            />
          ) : (
            <p className="py-8 text-center text-sm text-fg-muted">لا توجد نقرات مسجّلة بعد.</p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 font-semibold text-fg">عمليات بحث بلا نتائج</h2>
          <p className="mb-4 text-sm text-fg-muted">طلب لا يجده المشترون: فرصة لجذب بائعين في هذه الأصناف.</p>
          {data.zeroResultQueries.length ? (
            <ul className="flex flex-col divide-y divide-line">
              {data.zeroResultQueries.map((q) => (
                <li key={q.query} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link href={`/listings?search=${encodeURIComponent(q.query)}`} className="min-w-0 truncate text-fg hover:text-primary">
                    {q.query}
                  </Link>
                  <span className="shrink-0 text-fg-muted tabular-nums">{fmt.int(q.count)}×</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-fg-muted">كل عمليات البحث الأخيرة وجدت نتائج.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
