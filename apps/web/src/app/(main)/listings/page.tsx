'use client';

import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { SlidersHorizontal, SearchX } from 'lucide-react';
import { useListings } from '@/hooks/useListings';
import { useCategories } from '@/hooks/useCategories';
import { ListingCard } from '@/components/ListingCard';
import { Button, Card, EmptyState, ErrorState, Input, Skeleton } from '@/components/ui';
import type { ListingsQuery } from '@/types/listing';

type Filters = { search: string; categoryId: string; minPrice: string; maxPrice: string };
const EMPTY: Filters = { search: '', categoryId: '', minPrice: '', maxPrice: '' };

function toQuery(f: Filters): ListingsQuery {
  return {
    limit: 20,
    search: f.search.trim() || undefined,
    categoryId: f.categoryId || undefined,
    minPrice: f.minPrice ? Number(f.minPrice) : undefined,
    maxPrice: f.maxPrice ? Number(f.maxPrice) : undefined,
  };
}

const KEYS = Object.keys(EMPTY) as (keyof Filters)[];

/** Filters live in the URL so results can be shared, bookmarked and linked (e.g. from home). */
function readUrl(): Filters {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? ''])) as Filters;
}

function writeUrl(f: Filters) {
  const params = new URLSearchParams();
  KEYS.forEach((k) => f[k].trim() && params.set(k, f[k].trim()));
  const qs = params.toString();
  window.history.replaceState(null, '', qs ? `/listings?${qs}` : '/listings');
}

export default function ListingsPage() {
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { flat: categories } = useCategories();
  const { listings, total, error, isLoading, isLoadingMore, isReachingEnd, setSize, size, retry } = useListings(
    toQuery(applied),
  );
  const { ref, inView } = useInView({ rootMargin: '400px' });

  useEffect(() => {
    if (inView && !isReachingEnd && !isLoadingMore && !error) setSize(size + 1);
  }, [inView, isReachingEnd, isLoadingMore, error, setSize, size]);

  useEffect(() => {
    const fromUrl = readUrl();
    setDraft(fromUrl);
    setApplied(fromUrl);
  }, []);

  const hasFilters = JSON.stringify(applied) !== JSON.stringify(EMPTY);
  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    setApplied(draft);
    writeUrl(draft);
    setFiltersOpen(false);
  };
  const reset = () => {
    setDraft(EMPTY);
    setApplied(EMPTY);
    writeUrl(EMPTY);
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-8 md:flex-row">
        <aside className="w-full shrink-0 md:w-72">
          {/* On phones the filters collapse so results are visible without scrolling past them. */}
          <Button
            variant="secondary"
            fullWidth
            className="md:hidden"
            aria-expanded={filtersOpen}
            aria-controls="listing-filters"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            {filtersOpen ? 'إخفاء التصفية' : hasFilters ? 'تعديل التصفية' : 'تصفية النتائج'}
          </Button>

          <Card id="listing-filters" className={`${filtersOpen ? 'block' : 'hidden'} mt-3 p-5 md:sticky md:top-24 md:mt-0 md:block`}>
            <form onSubmit={apply} className="flex flex-col gap-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-fg">
                <SlidersHorizontal className="h-5 w-5" aria-hidden /> تصفية النتائج
              </h2>
              <Input
                label="ابحث في العناوين"
                type="search"
                value={draft.search}
                onChange={(e) => setDraft({ ...draft, search: e.target.value })}
                placeholder="مثال: آيفون، كنبة، دراجة"
              />
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-category" className="text-sm font-medium text-fg">القسم</label>
                <select
                  id="filter-category"
                  value={draft.categoryId}
                  onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
                  className="min-h-11 rounded-control border border-line bg-surface px-3 text-fg focus:outline-none focus:ring-2 focus:ring-focus-ring"
                >
                  <option value="">كل الأقسام</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {'  '.repeat(c.depth)}
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset className="grid grid-cols-2 gap-3">
                <legend className="mb-1 text-sm font-medium text-fg">السعر</legend>
                <Input label="من" type="number" min={0} inputMode="numeric" value={draft.minPrice} onChange={(e) => setDraft({ ...draft, minPrice: e.target.value })} />
                <Input label="إلى" type="number" min={0} inputMode="numeric" value={draft.maxPrice} onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })} />
              </fieldset>
              <Button type="submit" fullWidth>عرض النتائج</Button>
              {hasFilters && (
                <Button variant="ghost" fullWidth onClick={reset}>مسح التصفية</Button>
              )}
            </form>
          </Card>
        </aside>

        <section className="min-w-0 flex-1" aria-labelledby="results-title" aria-busy={isLoading}>
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h1 id="results-title" className="text-2xl font-bold text-fg">الإعلانات</h1>
            {!isLoading && !error && (
              <p className="text-sm text-fg-muted" aria-live="polite">
                {total.toLocaleString('ar')} إعلان
              </p>
            )}
          </div>

          {error && listings.length === 0 ? (
            <Card>
              <ErrorState title="تعذّر تحميل الإعلانات" onRetry={retry} />
            </Card>
          ) : isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="aspect-[4/3] w-full rounded-none" />
                  <div className="space-y-3 p-4">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-5 w-1/3" />
                  </div>
                </Card>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <Card>
              <EmptyState
                icon={<SearchX className="h-6 w-6" aria-hidden />}
                title={hasFilters ? 'لا نتائج تطابق التصفية' : 'لا توجد إعلانات بعد'}
                description={hasFilters ? 'جرّب كلمات أخرى أو وسّع نطاق السعر.' : 'كن أول من ينشر إعلاناً في معرض الأشياء.'}
                action={hasFilters ? <Button variant="secondary" onClick={reset}>مسح التصفية</Button> : undefined}
              />
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
              <div ref={ref} className="flex h-20 items-center justify-center">
                {isLoadingMore && !isReachingEnd && <Skeleton className="h-2 w-24" />}
                {error && <Button variant="ghost" onClick={retry}>تعذّر تحميل المزيد — إعادة المحاولة</Button>}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
