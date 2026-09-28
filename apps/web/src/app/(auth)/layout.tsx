import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-700 to-brand-600 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8 text-center bg-gray-50 border-b border-gray-100">
          <h1 className="text-3xl font-bold text-primary mb-2">معرض الأشياء</h1>
          <p className="text-gray-500">سوقك المفضل للبيع والشراء</p>
        </div>
        <div className="p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
