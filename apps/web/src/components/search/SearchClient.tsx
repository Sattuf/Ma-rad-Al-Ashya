'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSearch, SearchQuery, searchApi } from '@/lib/api/search';
import { ListingCard } from '@/components/ListingCard';
import { Filter, Loader2, X } from 'lucide-react';
import { getOrCreateSessionId } from '@/lib/ab-testing';

export function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  
  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  const [filters, setFilters] = useState<SearchQuery>({
    q: searchParams.get('q') || '',
    type: searchParams.get('type') || '',
    propertyType: searchParams.get('propertyType') || '',
    minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
    maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
    bedrooms: searchParams.get('bedrooms') ? Number(searchParams.get('bedrooms')) : undefined,
    city: searchParams.get('city') || '',
  });

  const queryWithSession = { ...filters, session_id: sessionId };
  const { data, isLoading, error } = useSearch(queryWithSession);

  const onResultClicked = (listingId: string, position: number) => {
    if (data?.variant && sessionId) {
      searchApi.trackClick({
        query: filters.q || '',
        listing_id: listingId,
        position,
        variant: data.variant,
        session_id: sessionId
      });
    }
  };

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    });
    router.replace(`/search?${params.toString()}`, { scroll: false });
  }, [filters, router]);

  // Sync URL to state when query params change via back button
  useEffect(() => {
    setFilters({
      q: searchParams.get('q') || '',
      type: searchParams.get('type') || '',
      propertyType: searchParams.get('propertyType') || '',
      minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
      maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
      bedrooms: searchParams.get('bedrooms') ? Number(searchParams.get('bedrooms')) : undefined,
      city: searchParams.get('city') || '',
    });
  }, [searchParams]);

  const handleFilterChange = (key: keyof SearchQuery, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({ q: filters.q }); // keep search query
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Mobile filter toggle */}
      <div className="flex justify-between items-center mb-6 lg:hidden">
        <h1 className="text-2xl font-bold text-gray-900">
          {filters.q ? `نتائج البحث عن "${filters.q}"` : 'تصفح العقارات'}
        </h1>
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-surface border border-gray-200 rounded-lg text-gray-700 font-medium"
        >
          <Filter size={18} />
          <span>تصفية</span>
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Filters */}
        <aside
          className={`fixed inset-y-0 start-0 z-50 w-80 bg-surface shadow-xl lg:shadow-none lg:bg-transparent lg:static lg:block lg:w-1/4 transition-transform duration-300 ${
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="p-6 lg:p-0 h-full overflow-y-auto lg:overflow-visible">
            <div className="flex justify-between items-center mb-6 lg:hidden">
              <h2 className="text-xl font-bold">تصفية النتائج</h2>
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="bg-surface lg:border lg:border-gray-200 rounded-2xl lg:p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-gray-900 hidden lg:block">تصفية النتائج</h3>
                <button
                  onClick={handleClearFilters}
                  className="text-sm text-primary hover:text-primary-hover font-medium"
                >
                  مسح الكل
                </button>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">نوع العملية</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleFilterChange('type', '')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${!filters.type ? 'bg-primary text-on-primary' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    الكل
                  </button>
                  <button
                    onClick={() => handleFilterChange('type', 'sale')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${filters.type === 'sale' ? 'bg-primary text-on-primary' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    للبيع
                  </button>
                  <button
                    onClick={() => handleFilterChange('type', 'rent')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${filters.type === 'rent' ? 'bg-primary text-on-primary' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    للإيجار
                  </button>
                </div>
              </div>

              {/* Property Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">نوع العقار</label>
                <select
                  value={filters.propertyType || ''}
                  onChange={(e) => handleFilterChange('propertyType', e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-focus-ring text-gray-700"
                >
                  <option value="">الكل</option>
                  <option value="apartment">شقة</option>
                  <option value="house">بيت / منزل</option>
                  <option value="villa">فيلا</option>
                  <option value="land">أرض</option>
                  <option value="commercial">تجاري</option>
                </select>
              </div>

              {/* City */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">المدينة</label>
                <input
                  type="text"
                  value={filters.city || ''}
                  onChange={(e) => handleFilterChange('city', e.target.value)}
                  placeholder="ابحث عن مدينة..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-focus-ring text-gray-700"
                />
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">السعر (ر.س)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={filters.minPrice || ''}
                    onChange={(e) => handleFilterChange('minPrice', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="من"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring text-gray-700"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="number"
                    value={filters.maxPrice || ''}
                    onChange={(e) => handleFilterChange('maxPrice', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="إلى"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring text-gray-700"
                  />
                </div>
              </div>

              {/* Bedrooms */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">عدد الغرف</label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleFilterChange('bedrooms', filters.bedrooms === num ? undefined : num)}
                      className={`w-10 h-10 rounded-xl text-sm font-medium transition-colors ${
                        filters.bedrooms === num
                          ? 'bg-primary text-on-primary'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {num}{num === 5 ? '+' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Apply Button (Mobile Only) */}
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold mt-6 lg:hidden"
              >
                تطبيق الفلاتر
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1">
          <div className="hidden lg:block mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              {filters.q ? `نتائج البحث عن "${filters.q}"` : 'تصفح جميع العقارات'}
            </h1>
            <p className="text-gray-500 mt-2">
              {data ? `تم العثور على ${data.meta?.total || data.data?.length || 0} نتيجة` : 'جاري البحث...'}
            </p>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-primary">
              <Loader2 className="animate-spin w-10 h-10 mb-4" />
              <p className="text-gray-600 font-medium">جاري تحميل النتائج...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-6 rounded-2xl text-center">
              حدث خطأ أثناء جلب النتائج. يرجى المحاولة مرة أخرى.
            </div>
          ) : data?.data && data.data.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {data.data.map((listing, index) => (
                <ListingCard 
                  key={listing.id} 
                  listing={listing} 
                  onClick={() => onResultClicked(listing.id, index)} 
                />
              ))}
            </div>
          ) : (
            <div className="bg-surface border border-gray-200 rounded-2xl p-12 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Filter size={32} className="text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">لا توجد نتائج</h3>
              <p className="text-gray-500 mb-6">لم نعثر على أي عقارات تطابق خيارات البحث الخاصة بك.</p>
              <button
                onClick={handleClearFilters}
                className="px-6 py-2.5 bg-primary-soft text-primary font-bold rounded-xl hover:bg-primary-soft transition-colors"
              >
                مسح الفلاتر والمحاولة مرة أخرى
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
