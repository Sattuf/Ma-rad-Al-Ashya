'use client';

import Link from 'next/link';
import { SearchBar } from '@/components/search/SearchBar';
import { User, PlusCircle, LayoutDashboard } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth-store';
import { ThemeToggle } from '@/components/ui';
import { useEffect, useState } from 'react';

export function Navbar() {
  const { user, isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-surface border-b border-gray-100 shadow-sm">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-10 h-10 bg-primary text-on-primary rounded-xl flex items-center justify-center font-bold text-xl">
            م
          </div>
          <span className="font-bold text-xl text-gray-900 hidden sm:block">معرض الأشياء</span>
        </Link>
        
        <div className="flex-1 max-w-2xl mx-auto flex justify-center">
          <SearchBar />
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <ThemeToggle />
          {mounted && user?.role === 'admin' && (
            <Link
              href="/admin"
              className="hidden sm:flex items-center gap-2 text-primary bg-primary-soft px-4 py-2.5 rounded-full font-medium hover:bg-primary-soft transition-colors ms-2"
            >
              <LayoutDashboard size={20} />
              <span>لوحة التحكم</span>
            </Link>
          )}
          
          <Link
            href="/listings/new"
            className="hidden sm:flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-full font-medium hover:bg-primary transition-colors shadow-sm"
          >
            <PlusCircle size={20} />
            <span>أضف إعلانك</span>
          </Link>
          
          <Link
            href={mounted && isAuthenticated ? "/profile" : "/login"}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 text-gray-700 transition-colors"
          >
            {mounted && user?.avatar ? (
              <img src={user.avatar} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <User size={20} />
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
