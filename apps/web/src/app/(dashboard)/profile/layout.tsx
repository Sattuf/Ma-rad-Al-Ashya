import React from 'react';
import Link from 'next/link';
import { User, Bell, Settings } from 'lucide-react';

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col md:flex-row" dir="rtl">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-surface border-e border-gray-100 p-6 md:min-h-screen">
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-700 to-brand-700 mb-8">
          إعدادات الحساب
        </h2>
        <nav className="space-y-2">
          <Link
            href="/profile"
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-primary-soft text-gray-700 hover:text-primary-hover transition-colors"
          >
            <User className="w-5 h-5" />
            <span className="font-medium">الملف الشخصي</span>
          </Link>
          <Link
            href="/profile/edit"
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-primary-soft text-gray-700 hover:text-primary-hover transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">تعديل البيانات</span>
          </Link>
          <Link
            href="/profile/notifications"
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-primary-soft text-gray-700 hover:text-primary-hover transition-colors"
          >
            <Bell className="w-5 h-5" />
            <span className="font-medium">الإشعارات</span>
          </Link>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10">
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
