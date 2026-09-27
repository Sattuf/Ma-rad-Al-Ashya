import Link from 'next/link';
import { 
  Building2, 
  Car, 
  Smartphone, 
  Sofa, 
  Briefcase, 
  HeartHandshake, 
  Dog, 
  Ticket 
} from 'lucide-react';

export const metadata = {
  title: 'استكشف الأقسام - مراد',
  description: 'تصفح جميع الأقسام والفئات المتاحة في مراد',
};

const categories = [
  {
    id: 'real-estate',
    name: 'عقارات',
    icon: Building2,
    color: 'bg-primary-soft text-primary',
    stats: '12,400+ إعلان',
    description: 'شقق، فلل، أراضي، مكاتب للبيع والإيجار',
    href: '/search?category=real-estate'
  },
  {
    id: 'vehicles',
    name: 'سيارات ومركبات',
    icon: Car,
    color: 'bg-red-50 text-red-600',
    stats: '8,200+ إعلان',
    description: 'سيارات جديدة ومستعملة، دراجات، قطع غيار',
    href: '/search?category=vehicles'
  },
  {
    id: 'electronics',
    name: 'أجهزة وإلكترونيات',
    icon: Smartphone,
    color: 'bg-purple-50 text-purple-600',
    stats: '15,100+ إعلان',
    description: 'جوالات، لابتوبات، شاشات، أجهزة منزلية',
    href: '/search?category=electronics'
  },
  {
    id: 'furniture',
    name: 'أثاث وديكور',
    icon: Sofa,
    color: 'bg-amber-50 text-amber-600',
    stats: '5,300+ إعلان',
    description: 'غرف نوم، مجالس، مطابخ، أثاث مكتبي',
    href: '/search?category=furniture'
  },
  {
    id: 'jobs',
    name: 'وظائف وأعمال',
    icon: Briefcase,
    color: 'bg-primary-soft text-primary',
    stats: '1,200+ إعلان',
    description: 'وظائف شاغرة، باحثين عن عمل، خدمات أعمال',
    href: '/search?category=jobs'
  },
  {
    id: 'services',
    name: 'خدمات',
    icon: HeartHandshake,
    color: 'bg-primary-soft text-primary',
    stats: '4,800+ إعلان',
    description: 'مقاولات، تنظيف، نقل عفش، خدمات عامة',
    href: '/search?category=services'
  },
  {
    id: 'pets',
    name: 'حيوانات أليفة',
    icon: Dog,
    color: 'bg-orange-50 text-orange-600',
    stats: '2,100+ إعلان',
    description: 'قطط، طيور، أسماك، مستلزمات حيوانات',
    href: '/search?category=pets'
  },
  {
    id: 'tickets',
    name: 'تذاكر وفعاليات',
    icon: Ticket,
    color: 'bg-pink-50 text-pink-600',
    stats: '850+ إعلان',
    description: 'حفلات، مباريات، فعاليات ترفيهية',
    href: '/search?category=tickets'
  }
];

export default function ExplorePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12" dir="rtl">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">استكشف الأقسام</h1>
          <p className="text-lg text-gray-600">
            تصفح آلاف الإعلانات في مختلف الأقسام والفئات. ابحث عن ما تريده أو اعرض ما لديك للبيع بكل سهولة.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {categories.map((category) => (
            <Link 
              key={category.id} 
              href={category.href}
              className="group bg-surface rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 flex flex-col items-center text-center hover:-translate-y-1"
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${category.color}`}>
                <category.icon className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{category.name}</h2>
              <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-sm font-medium rounded-full mb-4">
                {category.stats}
              </span>
              <p className="text-gray-500 text-sm line-clamp-2">
                {category.description}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-16 bg-surface rounded-2xl p-8 shadow-sm border border-gray-100 text-center max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">هل لديك شيء للبيع؟</h3>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            انضم إلى آلاف البائعين على منصة مراد وابدأ في عرض إعلاناتك للوصول إلى أكبر شريحة من المشترين المهتمين.
          </p>
          <Link 
            href="/listings/create" 
            className="inline-block bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-xl transition-colors"
          >
            أضف إعلانك الآن مجاناً
          </Link>
        </div>
      </div>
    </div>
  );
}
