import { Suspense } from 'react';
import { SearchClient } from '@/components/search/SearchClient';
import { Loader2 } from 'lucide-react';

export const metadata = {
  title: 'البحث | معرض الأشياء',
  description: 'ابحث عن العقارات والسيارات وغيرها في معرض الأشياء',
};

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[50vh] items-center justify-center text-blue-600">
        <Loader2 className="animate-spin w-12 h-12" />
      </div>
    }>
      <SearchClient />
    </Suspense>
  );
}
