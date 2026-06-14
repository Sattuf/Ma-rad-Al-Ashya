'use client';

import { useState, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { useListings } from '@/hooks/useListings';
import { ListingCard } from '@/components/ListingCard';
import { Filter, Search } from 'lucide-react';

export default function ListingsPage() {
  const [filters, setFilters] = useState({
    type: '',
    propertyType: '',
    city: '',
  });

  const { listings, isLoading, isLoadingMore, isReachingEnd, setSize, size } = useListings(filters);
  const { ref, inView } = useInView();

  useEffect(() => {
    if (inView && !isReachingEnd && !isLoadingMore) {
      setSize(size + 1);
    }
  }, [inView, isReachingEnd, isLoadingMore, setSize, size]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Filters */}
        <aside className="w-full md:w-64 shrink-0">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 sticky top-24">
            <div className="flex items-center gap-2 mb-6 text-gray-900 font-bold text-lg">
              <Filter size={20} />
              <h2>الفلاتر</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">نوع العقار</label>
                <select
                  value={filters.propertyType}
                  onChange={(e) => setFilters(f => ({ ...f, propertyType: e.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2"
                >
                  <option value="">الكل</option>
                  <option value="apartment">شقة</option>
                  <option value="house">بيت / دور</option>
                  <option value="villa">فيلا</option>
                  <option value="land">أرض</option>
                  <option value="commercial">تجاري</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">النوع</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2"
                >
                  <option value="">الكل</option>
                  <option value="sale">للبيع</option>
                  <option value="rent">للإيجار</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">المدينة</label>
                <input
                  type="text"
                  value={filters.city}
                  onChange={(e) => setFilters(f => ({ ...f, city: e.target.value }))}
                  placeholder="مثال: الرياض"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2"
                />
              </div>
            </div>
          </div>
        </aside>

        {/* Listings Grid */}
        <main className="flex-1">
          <div className="mb-6 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">العقارات المتاحة</h1>
            <span className="text-gray-500 text-sm">
              {listings.length} عقار
            </span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-[340px] animate-pulse">
                  <div className="h-48 bg-gray-200 w-full" />
                  <div className="p-4 space-y-4">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="flex gap-4 pt-4">
                      <div className="h-4 bg-gray-200 rounded w-12" />
                      <div className="h-4 bg-gray-200 rounded w-12" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : listings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={24} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">لا توجد عقارات</h3>
              <p className="text-gray-500 mt-1">لم نتمكن من العثور على عقارات تطابق بحثك</p>
            </div>
          )}

          {/* Infinite Scroll trigger */}
          <div ref={ref} className="py-8 flex justify-center">
            {isLoadingMore && (
              <div className="flex gap-2 items-center text-primary">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
            )}
            {isReachingEnd && listings.length > 0 && (
              <p className="text-gray-500 text-sm">نهاية النتائج</p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
