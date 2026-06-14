'use client';

import { useParams, useRouter } from 'next/navigation';
import { useListingDetail } from '@/hooks/useListings';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { listingsApi } from '@/lib/api/listings';
import { MapPin } from 'lucide-react';
import Map from '@/components/Map';

const editSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(20),
  price: z.coerce.number().min(1),
  type: z.enum(['sale', 'rent']),
  propertyType: z.enum(['apartment', 'house', 'villa', 'land', 'commercial']),
  bedrooms: z.coerce.number().optional(),
  bathrooms: z.coerce.number().optional(),
  area: z.coerce.number().min(1),
});

export default function EditListingPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { listing, isLoading } = useListingDetail(id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState({ lat: 24.7136, lng: 46.6753, address: '', city: '' });

  const { register, handleSubmit, reset } = useForm({
    resolver: zodResolver(editSchema),
  });

  useEffect(() => {
    if (listing) {
      reset({
        title: listing.title,
        description: listing.description,
        price: listing.price,
        type: listing.type,
        propertyType: listing.propertyType,
        bedrooms: listing.bedrooms || 0,
        bathrooms: listing.bathrooms || 0,
        area: listing.area,
      });
      setLocation(listing.location);
    }
  }, [listing, reset]);

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      await listingsApi.updateListing(id, { ...data, location });
      router.push('/my-listings');
    } catch (error) {
      alert('حدث خطأ أثناء التعديل');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center">جاري التحميل...</div>;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">تعديل العقار</h1>
      
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">العنوان</label>
          <input {...register('title')} className="w-full border p-3 rounded-lg" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">السعر</label>
            <input type="number" {...register('price')} className="w-full border p-3 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">المساحة</label>
            <input type="number" {...register('area')} className="w-full border p-3 rounded-lg" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">الوصف</label>
          <textarea {...register('description')} rows={4} className="w-full border p-3 rounded-lg" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">المدينة</label>
            <input 
              value={location.city}
              onChange={e => setLocation({ ...location, city: e.target.value })}
              className="w-full border p-3 rounded-lg" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">العنوان / الحي</label>
            <input 
              value={location.address}
              onChange={e => setLocation({ ...location, address: e.target.value })}
              className="w-full border p-3 rounded-lg" 
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">تحديث الموقع</label>
          <Map position={location} onPositionChange={setLocation} />
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t">
          <button type="button" onClick={() => router.back()} className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            إلغاء
          </button>
          <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
            {isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </form>
    </div>
  );
}
