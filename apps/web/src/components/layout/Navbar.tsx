'use client';

import Link from 'next/link';
import { SearchBar } from '@/components/search/SearchBar';
import { User, PlusCircle, LayoutDashboard, MessageSquare } from 'lucide-react';
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
    <header className="sticky top-0 z-40 w-full bg-surface border-b border-line shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-3 sm:gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-10 h-10 bg-primary text-on-primary rounded-xl flex items-center justify-center font-bold text-xl">
            م
          </div>
          <span className="font-bold text-xl text-fg hidden md:block">معرض الأشياء</span>
        </Link>
        
        <div className="flex-1 max-w-2xl mx-auto flex justify-center">
          <SearchBar />
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <ThemeToggle />
          {mounted && user?.role === 'admin' && (
            <Link
              href="/admin"
              className="hidden sm:flex items-center gap-2 text-primary bg-primary-soft px-4 py-2.5 rounded-full font-medium hover:bg-primary-soft transition-colors"
            >
              <LayoutDashboard size={20} aria-hidden />
              <span>لوحة التحكم</span>
            </Link>
          )}
          
          <Link
            href="/listings/create"
            aria-label="أضف إعلانك"
            className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-pill bg-primary px-3 font-medium text-on-primary shadow-sm transition-colors hover:bg-primary-hover sm:px-4"
          >
            <PlusCircle size={20} aria-hidden />
            <span className="hidden sm:inline">أضف إعلانك</span>
          </Link>

          {mounted && isAuthenticated && (
            <Link
              href="/messages"
              aria-label="الرسائل"
              className="hidden h-11 w-11 items-center justify-center rounded-pill text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg sm:flex"
            >
              <MessageSquare size={20} aria-hidden />
            </Link>
          )}

          <Link
            href={mounted && isAuthenticated ? '/profile' : '/login'}
            aria-label={mounted && isAuthenticated ? 'حسابي' : 'تسجيل الدخول'}
            className="flex h-11 w-11 items-center justify-center rounded-pill text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
          >
            {mounted && user?.avatar ? (
              <img src={user.avatar} alt="" className="h-8 w-8 rounded-pill object-cover" />
            ) : (
              <User size={20} aria-hidden />
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
