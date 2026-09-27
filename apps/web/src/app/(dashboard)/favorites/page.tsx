'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorite';
import { ListingCard } from '@/components/ListingCard';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';

export default function FavoritesPage() {
  const { favorites, isLoading, isError, mutate } = useFavorites(1, 100);
  const listings = favorites?.data ?? [];

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-fg">المفضّلة</h1>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="aspect-[3/4]" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <ErrorState error={isError} title="تعذّر تحميل المفضّلة" onRetry={() => mutate()} />
        </Card>
      ) : listings.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Heart className="h-6 w-6" aria-hidden />}
            title="لم تحفظ أي إعلان بعد"
            description="اضغط على القلب في أي إعلان لتجده هنا لاحقاً، حتى لو أغلقت الموقع."
            action={
              <Link href="/listings" className="inline-flex min-h-11 items-center rounded-control bg-primary px-5 font-semibold text-on-primary hover:bg-primary-hover">
                تصفّح الإعلانات
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </main>
  );
}
