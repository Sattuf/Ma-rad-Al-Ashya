'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDebounce } from 'use-debounce';
import { useAutocomplete } from '@/lib/api/search';
import { Search, X, Loader2 } from 'lucide-react';
import Link from 'next/link';

export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query, 300);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: suggestions, isLoading } = useAutocomplete(debouncedQuery);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setIsOpen(false);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-xl z-50">
      <form onSubmit={handleSubmit} className="relative flex items-center w-full">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="ابحث عن عقارات، سيارات، إلكترونيات..."
          className="w-full h-12 ps-5 pe-20 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-focus-ring focus:bg-surface transition-all text-gray-900 placeholder-gray-500 text-sm"
          dir="rtl"
        />
        <div className="absolute end-2 top-0 h-full flex items-center space-x-reverse space-x-1">
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setIsOpen(false);
              }}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={16} />
            </button>
          )}
          <button
            type="submit"
            className="w-9 h-9 flex items-center justify-center bg-primary hover:bg-primary text-on-primary rounded-full transition-colors shadow-sm"
          >
            <Search size={16} />
          </button>
        </div>
      </form>

      {isOpen && query.length >= 2 && (
        <div className="absolute top-[calc(100%+8px)] end-0 start-0 w-full bg-surface rounded-xl shadow-xl border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="p-6 flex justify-center text-gray-400">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : suggestions && suggestions.length > 0 ? (
            <ul className="py-2">
              {suggestions.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/listings/${item.id}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center px-4 py-3 hover:bg-gray-50 text-gray-700 transition-colors"
                  >
                    <Search size={16} className="text-gray-400 me-3 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-6 text-center text-gray-500 text-sm">
              لا توجد نتائج مطابقة لـ "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
