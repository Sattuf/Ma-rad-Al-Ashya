'use client';

import Link from 'next/link';
import { ArrowLeft, Camera, MessageSquare, PlusCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useListings } from '@/hooks/useListings';
import { useCategories } from '@/hooks/useCategories';
import { ListingCard } from '@/components/ListingCard/ListingCard';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import type { Listing } from '@/types/listing';

function ListingGrid({ listings, loading, count = 4 }: { listings: Listing[]; loading: boolean; count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
      {loading
        ? Array.from({ length: count }, (_, i) => <Skeleton key={i} className="aspect-[3/4] w-full" />)
        : listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
    </div>
  );
}

function SectionHeader({ title, subtitle, href, icon }: { title: string; subtitle?: string; href?: string; icon?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-fg sm:text-2xl">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:text-primary-hover">
          عرض الكل <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

const STEPS = [
  { icon: Camera, title: 'صوّر واكتب', text: 'أضف صوراً واضحة ووصفاً صادقاً وسعراً مناسباً.' },
  { icon: MessageSquare, title: 'تحدّث مع المشتري', text: 'تواصلا عبر الرسائل دون مشاركة رقمك.' },
  { icon: ShieldCheck, title: 'التقِ وسلّم بأمان', text: 'التقِ في مكان عام، وافحص السلعة قبل الدفع.' },
];

export default function HomePage() {
  const { tree: categories } = useCategories();
  const recommended = useRecommendations(4);
  const latest = useListings({ limit: 8 });
  const showRecommended = recommended.isLoading || recommended.listings.length > 0;

  return (
    <main className="pb-16">
      <section className="border-b border-line bg-surface">
        <div className="container mx-auto px-4 py-12 text-center sm:py-16">
          <h1 className="mx-auto max-w-3xl text-balance text-3xl font-extrabold leading-tight text-fg sm:text-5xl">
            بِع ما لا تحتاجه، واعثر على ما تبحث عنه
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-fg-muted">
            سوق محلي للأغراض المستعملة والجديدة: أجهزة، أثاث، ملابس، وأكثر — من أناس قريبين منك.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/listings" className="inline-flex min-h-12 items-center justify-center rounded-control bg-primary px-8 font-bold text-on-primary hover:bg-primary-hover">
              تصفّح الإعلانات
            </Link>
            <Link
              href="/listings/create"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control border border-line-strong px-8 font-bold text-fg hover:bg-surface-muted"
            >
              <PlusCircle className="h-5 w-5" aria-hidden /> أضف إعلانك مجاناً
            </Link>
          </div>

          {categories.length > 0 && (
            <nav aria-label="الأقسام" className="mt-10">
              <ul className="flex flex-wrap justify-center gap-2">
                {categories.slice(0, 10).map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/listings?categoryId=${c.id}`}
                      className="inline-flex min-h-11 items-center rounded-pill border border-line bg-canvas px-4 text-sm font-medium text-fg hover:border-primary hover:text-primary"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </section>

      <div className="container mx-auto flex flex-col gap-14 px-4 pt-10">
        {showRecommended && (
          <section aria-labelledby="recommended-heading">
            <div id="recommended-heading">
              <SectionHeader
                title="مقترح لك"
                subtitle={recommended.personalized ? 'بناءً على ما تصفّحته مؤخراً' : 'إعلانات قد تهمّك'}
                icon={<Sparkles className="h-5 w-5 text-warning" aria-hidden />}
              />
            </div>
            <ListingGrid listings={recommended.listings} loading={recommended.isLoading} />
          </section>
        )}

        <section aria-labelledby="latest-heading">
          <div id="latest-heading">
            <SectionHeader title="أحدث الإعلانات" href="/listings" />
          </div>
          {latest.error ? (
            <Card>
              <ErrorState error={latest.error} title="تعذّر تحميل الإعلانات" onRetry={latest.retry} />
            </Card>
          ) : !latest.isLoading && latest.listings.length === 0 ? (
            <Card>
              <EmptyState
                title="لا توجد إعلانات بعد"
                description="كن أول من ينشر إعلاناً في معرض الأشياء."
                action={
                  <Link href="/listings/create" className="inline-flex min-h-11 items-center rounded-control bg-primary px-5 font-semibold text-on-primary hover:bg-primary-hover">
                    أضف إعلانك
                  </Link>
                }
              />
            </Card>
          ) : (
            <ListingGrid listings={latest.listings.slice(0, 8)} loading={latest.isLoading} count={8} />
          )}
        </section>

        <section aria-labelledby="how-heading" className="rounded-card border border-line bg-surface p-6 sm:p-10">
          <h2 id="how-heading" className="mb-8 text-center text-xl font-bold text-fg sm:text-2xl">كيف يعمل معرض الأشياء؟</h2>
          <ol className="grid gap-8 sm:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex flex-col items-center gap-3 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-primary-soft text-on-primary-soft">
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <p className="font-semibold text-fg">
                  {i + 1}. {title}
                </p>
                <p className="text-sm text-fg-muted">{text}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
