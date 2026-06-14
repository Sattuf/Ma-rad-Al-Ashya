'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTransactions } from '@/hooks/useTransactions';
import { ShoppingBag, Tag, ChevronLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending_seller':
      return <span className="px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">بانتظار البائع</span>;
    case 'pending_buyer':
      return <span className="px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">بانتظار المشتري</span>;
    case 'completed':
      return <span className="px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full">مكتمل</span>;
    case 'cancelled':
      return <span className="px-2.5 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">ملغي</span>;
    default:
      return <span className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">{status}</span>;
  }
};

export default function TransactionsDashboard() {
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [page, setPage] = useState(1);

  const { transactions, isLoading } = useTransactions(role, undefined, page, 10);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">المعاملات</h1>
        <p className="mt-1 text-sm text-gray-500">تابع عمليات البيع والشراء الخاصة بك</p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 space-x-reverse" aria-label="Tabs">
          <button
            onClick={() => { setRole('buyer'); setPage(1); }}
            className={`${
              role === 'buyer'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } flex whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium items-center gap-2`}
          >
            <ShoppingBag className="w-5 h-5" />
            كمشتري
          </button>
          <button
            onClick={() => { setRole('seller'); setPage(1); }}
            className={`${
              role === 'seller'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } flex whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium items-center gap-2`}
          >
            <Tag className="w-5 h-5" />
            كبائع
          </button>
        </nav>
      </div>

      <div className="bg-white shadow sm:rounded-md">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 animate-pulse">جاري التحميل...</div>
        ) : transactions && transactions.length > 0 ? (
          <ul role="list" className="divide-y divide-gray-200">
            {transactions.map((transaction: any) => (
              <li key={transaction.id}>
                <Link href={`/transactions/${transaction.id}`} className="block hover:bg-gray-50 transition-colors">
                  <div className="flex items-center px-4 py-4 sm:px-6">
                    <div className="min-w-0 flex-1 flex items-center">
                      <div className="flex-shrink-0 relative">
                        {transaction.listing?.images?.[0] ? (
                          <img
                            src={transaction.listing.images[0]}
                            alt={transaction.listing.title}
                            className="h-16 w-16 rounded-md object-cover"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-md bg-gray-100 flex items-center justify-center">
                            <Tag className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 px-4 md:grid md:grid-cols-2 md:gap-4">
                        <div>
                          <p className="text-sm font-medium text-emerald-600 truncate">{transaction.listing?.title || 'إعلان غير متاح'}</p>
                          <p className="mt-2 flex items-center text-sm text-gray-500">
                            <span className="truncate">
                              {role === 'buyer' ? 'البائع: ' : 'المشتري: '}
                              {role === 'buyer' ? transaction.seller?.name : transaction.buyer?.name}
                            </span>
                          </p>
                        </div>
                        <div className="hidden md:block">
                          <div>
                            <p className="text-sm text-gray-900">
                              تم الإنشاء
                              <time dateTime={transaction.createdAt} className="mx-1">
                                {transaction.createdAt ? formatDistanceToNow(new Date(transaction.createdAt), { addSuffix: true, locale: ar }) : ''}
                              </time>
                            </p>
                            <p className="mt-2 flex items-center text-sm text-gray-500">
                              السعر: {transaction.listing?.price} ريال
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 ml-5">
                      {getStatusBadge(transaction.status)}
                      <ChevronLeft className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-8 text-center text-gray-500">
            لا توجد معاملات {role === 'buyer' ? 'كمشتري' : 'كبائع'} حالياً.
          </div>
        )}
      </div>
    </div>
  );
}
