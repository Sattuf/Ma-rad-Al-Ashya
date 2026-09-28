'use client';

import Link from 'next/link';
import { ChevronLeft, LayoutGrid, PlusCircle } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';

/** Every category from the catalogue (the same tree sellers pick from), linking to its listings. */
export default function ExplorePage() {
  const { tree, error, isLoading, retry } = useCategories();

  return (
    <main className="container mx-auto px-4 py-10">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-bold text-fg">كل الأقسام</h1>
        <p className="mt-2 text-fg-muted">اختر قسماً لتتصفّح إعلاناته، أو ابحث مباشرة من الشريط في الأعلى.</p>
      </header>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <ErrorState error={error} title="تعذّر تحميل الأقسام" onRetry={retry} />
        </Card>
      ) : tree.length === 0 ? (
        <Card>
          <EmptyState icon={<LayoutGrid className="h-6 w-6" aria-hidden />} title="لا توجد أقسام بعد" />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tree.map((category) => (
            <li key={category.id}>
              <Card className="flex h-full flex-col gap-3 p-5">
                <Link
                  href={`/listings?categoryId=${category.id}`}
                  className="flex min-h-11 items-center justify-between gap-2 text-lg font-semibold text-fg hover:text-primary"
                >
                  {category.name}
                  <ChevronLeft className="h-5 w-5 text-fg-subtle" aria-hidden />
                </Link>
                {!!category.children?.length && (
                  <ul className="flex flex-wrap gap-2">
                    {category.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/listings?categoryId=${child.id}`}
                          className="inline-flex min-h-9 items-center rounded-pill border border-line px-3 text-sm text-fg-muted hover:border-primary hover:text-primary"
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-10 flex flex-col items-center gap-4 p-8 text-center">
        <h2 className="text-xl font-semibold text-fg">عندك شيء لا تحتاجه؟</h2>
        <p className="max-w-md text-fg-muted">صوّره واكتب وصفاً صادقاً، وسيصل إلى مشترين قريبين منك. النشر مجاني.</p>
        <Link href="/listings/create" className="inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-6 font-semibold text-on-primary hover:bg-primary-hover">
          <PlusCircle className="h-5 w-5" aria-hidden /> أضف إعلانك
        </Link>
      </Card>
    </main>
  );
}
