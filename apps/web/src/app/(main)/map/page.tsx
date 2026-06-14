import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Dynamic import of the map component with ssr disabled
const InteractiveMap = dynamic(
  () => import('@/components/Map/InteractiveMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 animate-pulse">
        <div className="text-gray-400 font-medium">جاري تحميل الخريطة...</div>
      </div>
    )
  }
);

export const metadata = {
  title: 'الخريطة - مراد',
  description: 'استكشف الإعلانات على الخريطة',
};

// Dummy data for map listings
const dummyMapListings = [
  {
    id: '1',
    title: 'فيلا فاخرة للبيع',
    price: 1500000,
    images: ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=500&q=80'],
    location: { lat: 24.7136, lng: 46.6753 }
  },
  {
    id: '2',
    title: 'شقة مفروشة للإيجار',
    price: 45000,
    images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=500&q=80'],
    location: { lat: 24.7236, lng: 46.6853 }
  },
  {
    id: '3',
    title: 'أرض تجارية',
    price: 3000000,
    images: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=500&q=80'],
    location: { lat: 24.7036, lng: 46.6653 }
  },
  {
    id: '4',
    title: 'سيارة تويوتا كامري 2023',
    price: 110000,
    images: ['https://images.unsplash.com/photo-1621007947382-bb3c3994e3fd?w=500&q=80'],
    location: { lat: 24.7536, lng: 46.6953 }
  },
  {
    id: '5',
    title: 'لابتوب ماك بوك برو',
    price: 8500,
    images: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&q=80'],
    location: { lat: 24.7336, lng: 46.6553 }
  }
];

export default function MapPage() {
  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-80px)] w-full overflow-hidden" dir="rtl">
      {/* Sidebar Filters */}
      <div className="w-full md:w-80 lg:w-96 bg-white border-l border-gray-200 shadow-lg z-10 flex flex-col h-full overflow-y-auto">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">الخريطة</h1>
          
          <div className="space-y-6">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">بحث</label>
              <input 
                type="text" 
                placeholder="ابحث عن..." 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              />
            </div>

            {/* Categories */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">القسم</label>
              <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white">
                <option value="">جميع الأقسام</option>
                <option value="real-estate">عقارات</option>
                <option value="vehicles">سيارات</option>
                <option value="electronics">إلكترونيات</option>
                <option value="furniture">أثاث</option>
              </select>
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">السعر (ريال)</label>
              <div className="flex gap-4">
                <input 
                  type="number" 
                  placeholder="من" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
                <input 
                  type="number" 
                  placeholder="إلى" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>
            </div>

            <button className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-3 rounded-lg transition-colors">
              تطبيق الفلاتر
            </button>
          </div>
        </div>

        {/* Listings List (Sidebar) */}
        <div className="flex-1 border-t border-gray-100 overflow-y-auto bg-gray-50 p-4">
          <h2 className="text-sm font-bold text-gray-500 mb-4 px-2">النتائج ({dummyMapListings.length})</h2>
          <div className="space-y-4">
            {dummyMapListings.map(listing => (
              <div key={listing.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex gap-3 hover:shadow-md transition-shadow cursor-pointer">
                <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden shrink-0">
                  {listing.images && listing.images[0] && (
                    <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex flex-col justify-between py-1">
                  <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{listing.title}</h3>
                  <div className="text-primary font-bold">{listing.price.toLocaleString()} ريال</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative h-full bg-gray-100">
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <div className="text-gray-400 font-medium">جاري تحميل الخريطة...</div>
          </div>
        }>
          <InteractiveMap listings={dummyMapListings} />
        </Suspense>
      </div>
    </div>
  );
}
