import Link from 'next/link';
import { SearchBar } from '@/components/search/SearchBar';
import { User, PlusCircle } from 'lucide-react';

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-gray-100 shadow-sm">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-xl">
            م
          </div>
          <span className="font-bold text-xl text-gray-900 hidden sm:block">معرض الأشياء</span>
        </Link>
        
        <div className="flex-1 max-w-2xl mx-auto flex justify-center">
          <SearchBar />
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/listings/new"
            className="hidden sm:flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2.5 rounded-full font-medium hover:bg-blue-100 transition-colors"
          >
            <PlusCircle size={20} />
            <span>أضف إعلانك</span>
          </Link>
          
          <Link
            href="/login"
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 text-gray-700 transition-colors"
          >
            <User size={20} />
          </Link>
        </div>
      </div>
    </header>
  );
}
