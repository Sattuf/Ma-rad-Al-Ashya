'use client';

import Link from 'next/link';
import { useListings } from '@/hooks/useListings';
import { ListingCard } from '@/components/ListingCard';

interface RelatedListingsProps {
  currentListingId: string;
  categoryId?: string | null;
}

/** Other active listings in the same category (hidden when there are none). */
export default function RelatedListings({ currentListingId, categoryId }: RelatedListingsProps) {
  const { listings } = useListings({ categoryId: categoryId ?? undefined, limit: 5 });
  const related = listings.filter((l) => l.id !== currentListingId).slice(0, 4);
  if (!categoryId || related.length === 0) return null;

  return (
    <section className="mt-12" aria-labelledby="related-title">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="related-title" className="text-xl font-bold text-fg">إعلانات مشابهة</h2>
        <Link href={`/listings?categoryId=${categoryId}`} className="text-sm font-medium text-primary hover:text-primary-hover">
          عرض المزيد
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {related.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </section>
  );
}
