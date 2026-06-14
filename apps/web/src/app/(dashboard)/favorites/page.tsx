'use client';

import { useFavorites } from '@/hooks/useFavorite';
import { ListingCard } from '@/components/ListingCard';
import { HeartCrack, Loader2 } from 'lucide-react';

export default function FavoritesPage() {
  const { favorites, isLoading, isError } = useFavorites(1, 100);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center text-red-500 py-10">
        حدث خطأ أثناء تحميل الإعلانات المحفوظة.
      </div>
    );
  }

  const listings = favorites?.data || [];

  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <HeartCrack className="w-16 h-16 mb-4 text-gray-300" />
        <h2 className="text-xl font-semibold mb-2">لا توجد إعلانات محفوظة</h2>
        <p>تصفح الإعلانات واحفظ ما يعجبك للرجوع إليه لاحقاً.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">الإعلانات المحفوظة</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </div>
  );
}
