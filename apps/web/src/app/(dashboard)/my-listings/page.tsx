'use client';

import { useMyListings } from '@/hooks/useListings';
import Link from 'next/link';
import { Plus, Edit2, Trash2, Eye } from 'lucide-react';
import { listingsApi } from '@/lib/api/listings';

export default function MyListingsPage() {
  const { listings, isLoading, mutate } = useMyListings();

  const handleDelete = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا العقار؟')) {
      try {
        await listingsApi.deleteListing(id);
        mutate();
      } catch (error) {
        alert('حدث خطأ أثناء الحذف');
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">عقاراتي</h1>
          <p className="text-gray-500">إدارة العقارات الخاصة بك</p>
        </div>
        <Link 
          href="/listings/create" 
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={20} />
          <span>إضافة عقار جديد</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">ليس لديك أي عقارات</h3>
          <p className="text-gray-500 mb-6">ابدأ بإضافة عقارك الأول الآن ليصل إلى آلاف المهتمين</p>
          <Link 
            href="/listings/create" 
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={20} />
            <span>إضافة عقار</span>
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 text-sm">
                <tr>
                  <th className="px-6 py-4 font-medium">العقار</th>
                  <th className="px-6 py-4 font-medium">النوع</th>
                  <th className="px-6 py-4 font-medium">السعر</th>
                  <th className="px-6 py-4 font-medium">الحالة</th>
                  <th className="px-6 py-4 font-medium text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {listings.map(listing => (
                  <tr key={listing.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <img 
                          src={listing.images[0] || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=200&q=80'} 
                          alt="" 
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                        <div>
                          <p className="font-semibold text-gray-900 mb-1">{listing.title}</p>
                          <p className="text-sm text-gray-500">{listing.location.city}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {listing.type === 'sale' ? 'للبيع' : 'للإيجار'} - {listing.propertyType}
                    </td>
                    <td className="px-6 py-4 font-semibold text-primary">
                      {listing.price.toLocaleString()} ر.س
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        listing.status === 'active' ? 'bg-green-100 text-green-800' :
                        listing.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {listing.status === 'active' ? 'نشط' : listing.status === 'pending' ? 'قيد المراجعة' : listing.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link 
                          href={`/listings/${listing.id}`}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                          title="عرض"
                        >
                          <Eye size={18} />
                        </Link>
                        <Link 
                          href={`/listings/${listing.id}/edit`}
                          className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="تعديل"
                        >
                          <Edit2 size={18} />
                        </Link>
                        <button 
                          onClick={() => handleDelete(listing.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
