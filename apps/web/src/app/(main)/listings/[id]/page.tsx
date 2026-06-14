'use client';

import { useParams, useRouter } from 'next/navigation';
import { useListingDetail } from '@/hooks/useListings';
import Map from '@/components/Map';
import { MapPin, BedDouble, Bath, Square, Calendar, Share2, Heart, Phone } from 'lucide-react';
import Image from 'next/image';
import RelatedListings from '@/components/listings/RelatedListings';
import { useState } from 'react';

import { useAuthStore } from '@/lib/store/auth-store';
import { transactionsApi } from '@/lib/api/transactions';
import { ShoppingCart } from 'lucide-react';

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { listing, isLoading, error } = useListingDetail(id);
  const { user, isAuthenticated } = useAuthStore();
  const [isBuying, setIsBuying] = useState(false);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 animate-pulse">
        <div className="h-[400px] bg-gray-200 rounded-xl mb-8" />
        <div className="max-w-4xl space-y-4">
          <div className="h-8 bg-gray-200 rounded w-3/4" />
          <div className="h-6 bg-gray-200 rounded w-1/4" />
          <div className="flex gap-4 pt-4">
            <div className="h-10 bg-gray-200 rounded w-24" />
            <div className="h-10 bg-gray-200 rounded w-24" />
            <div className="h-10 bg-gray-200 rounded w-24" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">عذراً، لم يتم العثور على العقار</h2>
        <p className="text-gray-500">قد يكون العقار محذوفاً أو غير متاح حالياً.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Image Gallery */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4 h-[400px] md:h-[500px]">
        <div className="md:col-span-3 h-full relative rounded-xl overflow-hidden group">
          <img
            src={listing.images[0] || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80'}
            alt={listing.title}
            className="object-cover w-full h-full"
          />
          <div className="absolute top-4 right-4 flex gap-2">
            <span className="bg-white/90 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-semibold text-primary">
              {listing.type === 'sale' ? 'للبيع' : 'للإيجار'}
            </span>
          </div>
          <div className="absolute top-4 left-4 flex gap-2">
            <button className="p-2.5 bg-white/90 hover:bg-white backdrop-blur-sm rounded-full text-gray-700 transition-colors shadow-sm">
              <Share2 size={20} />
            </button>
            <button className="p-2.5 bg-white/90 hover:bg-white backdrop-blur-sm rounded-full text-gray-700 hover:text-red-500 transition-colors shadow-sm">
              <Heart size={20} />
            </button>
          </div>
        </div>
        <div className="hidden md:flex flex-col gap-4 h-full">
          {listing.images.slice(1, 3).map((img, idx) => (
            <div key={idx} className="h-1/2 relative rounded-xl overflow-hidden">
              <img src={img} alt={`${listing.title} - ${idx + 2}`} className="object-cover w-full h-full" />
            </div>
          ))}
          {listing.images.length > 3 && (
            <div className="absolute bottom-4 left-4">
              <button className="bg-white/90 px-4 py-2 rounded-lg font-medium text-sm shadow-sm hover:bg-white transition-colors">
                عرض كل الصور ({listing.images.length})
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          <div>
            <div className="flex justify-between items-start mb-4">
              <h1 className="text-3xl font-bold text-gray-900">{listing.title}</h1>
              <p className="text-3xl font-bold text-primary whitespace-nowrap mr-4">
                {listing.price.toLocaleString()} ر.س
              </p>
            </div>
            <div className="flex items-center text-gray-600 mb-6 text-lg">
              <MapPin size={20} className="ml-2 text-primary" />
              <span>{listing.location.city} - {listing.location.address}</span>
            </div>
            
            {/* Key Features */}
            <div className="flex flex-wrap gap-6 py-6 border-y border-gray-100">
              {listing.bedrooms && (
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg text-primary">
                    <BedDouble size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">غرف النوم</p>
                    <p className="font-semibold">{listing.bedrooms}</p>
                  </div>
                </div>
              )}
              {listing.bathrooms && (
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg text-primary">
                    <Bath size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">دورات المياه</p>
                    <p className="font-semibold">{listing.bathrooms}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 rounded-lg text-primary">
                  <Square size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">المساحة</p>
                  <p className="font-semibold">{listing.area} م²</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">وصف العقار</h2>
            <div className="text-gray-600 leading-relaxed whitespace-pre-line">
              {listing.description}
            </div>
          </div>

          {listing.features && listing.features.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">المميزات</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {listing.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-gray-600">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">الموقع</h2>
            <Map position={{ lat: listing.location.lat, lng: listing.location.lng }} readOnly />
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 sticky top-24">
            <h3 className="text-lg font-bold text-gray-900 mb-4">تواصل مع المعلن</h3>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-xl font-bold text-gray-400">
                A
              </div>
              <div>
                <p className="font-semibold text-gray-900">أحمد محمد</p>
                <p className="text-sm text-gray-500">عضو منذ 2023</p>
              </div>
            </div>
            
            <div className="space-y-3">
              {isAuthenticated && user?.id !== listing.userId && listing.status === 'active' && (
                <button 
                  onClick={async () => {
                    try {
                      setIsBuying(true);
                      const transaction = await transactionsApi.createTransaction(listing.id, listing.userId);
                      const tId = transaction.data?.id || transaction.id;
                      router.push(`/transactions/${tId}`);
                    } catch (err) {
                      console.error(err);
                      alert('حدث خطأ أثناء إنشاء الطلب');
                      setIsBuying(false);
                    }
                  }}
                  disabled={isBuying}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors mb-2 disabled:opacity-75"
                >
                  <ShoppingCart size={20} />
                  <span>{isBuying ? 'جاري الطلب...' : 'طلب شراء الآن'}</span>
                </button>
              )}
              <button className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
                <Phone size={20} />
                <span>إظهار الرقم</span>
              </button>
              <button className="w-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 font-medium py-3 px-4 rounded-lg transition-colors">
                إرسال رسالة
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Related Listings */}
      <RelatedListings currentListingId={id} categoryId={listing.category || 'real-estate'} />
    </div>
  );
}
