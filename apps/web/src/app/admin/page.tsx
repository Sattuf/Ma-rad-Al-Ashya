'use client';

import { useState, useEffect } from 'react';
import { adminApi, AdminStats } from '@/lib/api/admin';
import { AlertCircle, Flag, CheckCircle, BarChart3, Users, Building } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getDashboardStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  // Provide defaults if stats is null
  const data = stats || {
    pendingReports: 0,
    reportsToday: 0,
    resolvedToday: 0,
    totalReports: 0,
    topReportedListings: [],
    topReportedUsers: []
  };

  const statCards = [
    { title: 'بلاغات معلقة', value: data.pendingReports, icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'بلاغات اليوم', value: data.reportsToday, icon: Flag, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'تم حلها اليوم', value: data.resolvedToday, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'إجمالي البلاغات', value: data.totalReports, icon: BarChart3, color: 'text-teal-500', bg: 'bg-teal-500/10' },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-white">لوحة التحكم</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${card.bg}`}>
                  <Icon size={24} className={card.color} />
                </div>
                <span className="text-3xl font-bold text-white">{card.value}</span>
              </div>
              <h3 className="text-gray-400 font-medium">{card.title}</h3>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Reported Listings */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building className="text-teal-500" size={20} />
              <h2 className="text-xl font-bold text-white">الإعلانات الأكثر إبلاغاً</h2>
            </div>
          </div>
          <div className="p-0">
            {data.topReportedListings.length > 0 ? (
              <table className="w-full text-right">
                <thead className="bg-gray-900/50 text-gray-400 text-sm">
                  <tr>
                    <th className="p-4 font-medium">العنوان</th>
                    <th className="p-4 font-medium w-24">البلاغات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {data.topReportedListings.map(listing => (
                    <tr key={listing.id} className="hover:bg-gray-700/30 transition-colors">
                      <td className="p-4 text-white">
                        <Link href={`/listings/${listing.id}`} className="hover:text-teal-400 transition-colors line-clamp-1">
                          {listing.title}
                        </Link>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
                          {listing.count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-gray-500">لا توجد بيانات حالياً</div>
            )}
          </div>
        </div>

        {/* Top Reported Users */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="text-teal-500" size={20} />
              <h2 className="text-xl font-bold text-white">المستخدمين الأكثر إبلاغاً</h2>
            </div>
          </div>
          <div className="p-0">
            {data.topReportedUsers.length > 0 ? (
              <table className="w-full text-right">
                <thead className="bg-gray-900/50 text-gray-400 text-sm">
                  <tr>
                    <th className="p-4 font-medium">الاسم</th>
                    <th className="p-4 font-medium w-24">البلاغات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {data.topReportedUsers.map(user => (
                    <tr key={user.id} className="hover:bg-gray-700/30 transition-colors">
                      <td className="p-4 text-white">
                        <Link href={`/users/${user.id}`} className="hover:text-teal-400 transition-colors line-clamp-1">
                          {user.name}
                        </Link>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
                          {user.count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-gray-500">لا توجد بيانات حالياً</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
