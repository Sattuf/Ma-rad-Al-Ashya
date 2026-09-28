'use client';

import React, { useEffect, useState } from 'react';
import { fraudApi } from '@/lib/api/fraud';
import Link from 'next/link';

export default function FraudDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, signalsData] = await Promise.all([
          fraudApi.getDashboardStats(),
          fraudApi.getSignals(),
        ]);
        setStats(statsData.stats || statsData);
        setSignals(signalsData.signals || signalsData || []);
      } catch (error) {
        console.error('Error fetching fraud data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8 text-center">جارٍ التحميل…</div>;
  }

  const statCards = [
    { title: 'إجمالي الإشارات', value: stats?.total_signals || stats?.signals_today || 0, color: 'bg-brand-600/10 text-primary border-brand-600/20' },
    { title: 'مستخدمين ذوي خطورة عالية', value: stats?.high_risk_users || 0, color: 'bg-red-500/10 text-red-500 border-red-500/20' },
    { title: 'حسابات محظورة', value: stats?.blocked_users || stats?.locked_accounts || 0, color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
    { title: 'أنشطة مشبوهة مكتشفة', value: stats?.anomalies_detected || 0, color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'high': return 'bg-red-500/20 text-red-400';
      case 'medium': return 'bg-orange-500/20 text-orange-400';
      case 'low': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">لوحة تحكم مكافحة الاحتيال</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <div key={idx} className={`p-6 rounded-xl border ${card.color}`}>
            <h3 className="text-sm font-medium opacity-80 mb-2">{card.title}</h3>
            <p className="text-3xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">أحدث الإشارات (Signals)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-start">
            <thead className="bg-gray-900 text-gray-400 text-sm">
              <tr>
                <th className="p-4 font-medium">معرف المستخدم</th>
                <th className="p-4 font-medium">نوع الإشارة</th>
                <th className="p-4 font-medium">الخطورة</th>
                <th className="p-4 font-medium">التاريخ</th>
                <th className="p-4 font-medium">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {signals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    لا توجد إشارات حالياً
                  </td>
                </tr>
              ) : (
                signals.map((signal: any, idx) => (
                  <tr key={idx} className="hover:bg-gray-900/50 transition-colors">
                    <td className="p-4 text-sm text-gray-300">{signal.user_id}</td>
                    <td className="p-4 text-sm text-gray-300">{signal.signal_type || signal.type}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getSeverityColor(signal.severity)}`}>
                        {signal.severity || 'غير محدد'}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-400">
                      {new Date(signal.created_at || signal.timestamp).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="p-4">
                      <Link 
                        href={`/admin/fraud/${signal.user_id}`}
                        className="text-primary hover:text-brand-400 text-sm font-medium"
                      >
                        التفاصيل
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
