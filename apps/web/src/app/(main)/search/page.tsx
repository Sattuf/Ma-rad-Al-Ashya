'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { SearchClient } from '@/components/search/SearchClient';
import { Loader2 } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';

  useEffect(() => {
    if (q) {
      trackEvent('search', { searchQuery: q });
    }
  }, [q]);

  return <SearchClient />;
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[50vh] items-center justify-center text-primary">
        <Loader2 className="animate-spin w-12 h-12" />
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}

