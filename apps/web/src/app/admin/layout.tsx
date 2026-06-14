'use client';

import { useAuthStore } from '@/lib/store/auth-store';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Flag, Home, LogOut } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (mounted && (!isAuthenticated || user?.role !== 'admin')) {
      router.replace('/');
    }
  }, [mounted, isAuthenticated, user, router]);

  if (!mounted || !isAuthenticated || user?.role !== 'admin') {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
    </div>;
  }

  const navItems = [
    { name: 'لوحة التحكم', href: '/admin', icon: LayoutDashboard },
    { name: 'البلاغات', href: '/admin/reports', icon: Flag },
  ];

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col md:flex-row" dir="rtl">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-gray-950 text-white flex flex-col">
        <div className="p-6">
          <Link href="/admin" className="text-2xl font-bold text-teal-500 tracking-tighter">
            معرض <span className="text-white text-sm bg-teal-600 px-2 py-0.5 rounded ml-2">الإدارة</span>
          </Link>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-teal-600/10 text-teal-400' 
                    : 'text-gray-400 hover:bg-gray-900 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800 space-y-2">
          <Link 
            href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-900 hover:text-white transition-colors"
          >
            <Home size={20} />
            <span className="font-medium">العودة للموقع</span>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 bg-gray-900 text-gray-100 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
