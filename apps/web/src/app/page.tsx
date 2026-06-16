'use client';

import { useSuggestedListings } from '@/hooks/useRecommendations';
import { ListingCard } from '@/components/ListingCard/ListingCard';
import { Sparkles, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function ListingSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-pulse">
      <div className="h-48 bg-gray-200 w-full" />
      <div className="p-4 space-y-3 text-right">
        <div className="h-4 bg-gray-200 rounded w-2/3 mr-auto" />
        <div className="h-4 bg-gray-200 rounded w-1/2 mr-auto" />
        <div className="border-t border-gray-100 pt-4 flex justify-between">
          <div className="h-4 bg-gray-200 rounded w-8" />
          <div className="h-4 bg-gray-200 rounded w-8" />
          <div className="h-4 bg-gray-200 rounded w-8" />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { listings, isLoading, isPersonalized } = useSuggestedListings();

  return (
    <div className="min-h-screen bg-gray-50 text-right pb-16" dir="rtl">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-teal-800 to-teal-950 text-white py-24 overflow-hidden mb-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(20,184,166,0.15),transparent)] pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight leading-tight">
            ابحث عن عقارك المثالي في <span className="text-teal-400">معرض الأشياء</span>
          </h1>
          <p className="text-lg text-teal-100/90 max-w-2xl mx-auto mb-8 font-medium">
            تصفح الآلاف من العقارات المميزة المعروضة للبيع والإيجار بأسعار منافسة في جميع مناطق المملكة.
          </p>
          <div className="flex justify-center gap-4">
            <Link 
              href="/explore"
              className="bg-white text-teal-900 px-8 py-3.5 rounded-xl font-bold hover:bg-teal-50 transition-colors shadow-lg"
            >
              استكشف الأقسام
            </Link>
          </div>
        </div>
      </section>

      {/* Suggested for You Section */}
      <section className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
              <Sparkles className="text-amber-500 fill-amber-500" size={24} />
              <span>مقترح لك</span>
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {isPersonalized 
                ? 'توصيات مخصصة بناءً على اهتماماتك وتصفحك الأخير'
                : 'عقارات مختارة بعناية قد تنال إعجابك'}
            </p>
          </div>
          <Link href="/explore" className="text-teal-600 hover:text-teal-700 font-bold text-sm flex items-center gap-1">
            <span>استكشف المزيد</span>
            <ArrowLeft size={16} />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <ListingSkeleton key={i} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-gray-500 text-sm">لا توجد اقتراحات حالياً. تصفح الموقع وسنقوم بتخصيص الاقتراحات لك.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
