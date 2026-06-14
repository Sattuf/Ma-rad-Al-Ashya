import Link from 'next/link';

interface RelatedListingsProps {
  currentListingId: string;
  categoryId?: string;
}

// Mock related listings data
const getRelatedListings = (id: string, categoryId?: string) => {
  return [
    {
      id: '201',
      title: 'شقة 3 غرف للإيجار',
      price: 35000,
      location: 'الرياض، حي الملقا',
      timeAgo: 'قبل ساعتين',
      image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=500&q=80',
    },
    {
      id: '202',
      title: 'فيلا مودرن للبيع',
      price: 2500000,
      location: 'الرياض، حي الياسمين',
      timeAgo: 'قبل 5 ساعات',
      image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=500&q=80',
    },
    {
      id: '203',
      title: 'أرض سكنية زاوية',
      price: 1200000,
      location: 'الرياض، حي النرجس',
      timeAgo: 'قبل يوم',
      image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=500&q=80',
    },
    {
      id: '204',
      title: 'دور أرضي بمدخل خاص',
      price: 55000,
      location: 'الرياض، حي حطين',
      timeAgo: 'قبل يومين',
      image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=500&q=80',
    }
  ];
};

export default function RelatedListings({ currentListingId, categoryId }: RelatedListingsProps) {
  const listings = getRelatedListings(currentListingId, categoryId);

  if (!listings || listings.length === 0) return null;

  return (
    <div className="mt-12 border-t border-gray-100 pt-10" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">إعلانات مشابهة</h2>
        <Link href={`/search${categoryId ? `?category=${categoryId}` : ''}`} className="text-primary hover:text-primary-dark font-medium text-sm">
          عرض الكل
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {listings.map((listing) => (
          <Link key={listing.id} href={`/listings/${listing.id}`} className="group">
            <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300">
              {/* Image */}
              <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                <img 
                  src={listing.image} 
                  alt={listing.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-gray-900">
                  {listing.timeAgo}
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-bold text-gray-900 mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                  {listing.title}
                </h3>
                <div className="text-primary font-bold text-lg mb-2">
                  {listing.price.toLocaleString()} ريال
                </div>
                <div className="flex items-center text-gray-500 text-sm">
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="truncate">{listing.location}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
