'use client';

import { useEffect, useState } from 'react';
import { rankingApi, RankingStats } from '@/lib/api/ranking';
import { BarChart3, TrendingUp, Search, MousePointerClick, Loader2, Trophy } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export default function RankingDashboard() {
  const [stats, setStats] = useState<RankingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    rankingApi.getRankingStats()
      .then(setStats)
      .catch((err) => {
        console.error('Error fetching ranking stats:', err);
        setError('حدث خطأ أثناء تحميل الإحصائيات');
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-6 rounded-2xl text-center">
        {error || 'لم يتم العثور على بيانات'}
      </div>
    );
  }

  const variantA = stats.variants?.A || { total_searches: 0, total_clicks: 0, ctr: 0 };
  const variantB = stats.variants?.B || { total_searches: 0, total_clicks: 0, ctr: 0 };
  
  const winner = variantA.ctr > variantB.ctr ? 'A' : variantB.ctr > variantA.ctr ? 'B' : 'none';

  // Mock time-series data for 7 days
  const mockChartData = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return {
      date: date.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }),
      'الخوارزمية الذكية (A)': Number((variantA.ctr * (1 + (Math.random() * 0.2 - 0.1))).toFixed(2)),
      'الترتيب الزمني (B)': Number((variantB.ctr * (1 + (Math.random() * 0.2 - 0.1))).toFixed(2)),
    };
  });

  return (
    <div className="space-y-8" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">إحصائيات الترتيب الذكي</h1>
        <p className="text-gray-400">مقارنة أداء خوارزميات البحث وتتبع نقرات المستخدمين</p>
      </div>

      {/* A/B Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Variant A */}
        <div className={`relative p-6 rounded-2xl bg-gradient-to-br from-brand-950/40 to-gray-900 border ${winner === 'A' ? 'border-brand-600/50 shadow-[0_0_20px_rgba(20,184,166,0.15)]' : 'border-gray-800'}`}>
          {winner === 'A' && (
            <div className="absolute top-4 end-4 flex items-center gap-1.5 text-brand-400 bg-brand-600/10 px-3 py-1 rounded-full text-sm font-medium">
              <Trophy size={16} />
              <span>الأفضل أداءً</span>
            </div>
          )}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-brand-600/20 rounded-xl text-brand-400">
              <TrendingUp size={24} />
            </div>
            <h2 className="text-xl font-bold text-white">الخوارزمية الذكية (A)</h2>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800/50">
              <div className="text-gray-400 text-sm mb-1 flex items-center gap-1.5">
                <Search size={14} />
                عمليات البحث
              </div>
              <div className="text-2xl font-bold text-white">{variantA.total_searches}</div>
            </div>
            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800/50">
              <div className="text-gray-400 text-sm mb-1 flex items-center gap-1.5">
                <MousePointerClick size={14} />
                النقرات
              </div>
              <div className="text-2xl font-bold text-white">{variantA.total_clicks}</div>
            </div>
            <div className="bg-brand-600/10 p-4 rounded-xl border border-brand-600/20">
              <div className="text-brand-400 text-sm mb-1">نسبة النقر (CTR)</div>
              <div className="text-2xl font-bold text-brand-400">{variantA.ctr.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        {/* Variant B */}
        <div className={`relative p-6 rounded-2xl bg-gradient-to-br from-gray-800/40 to-gray-900 border ${winner === 'B' ? 'border-gray-400/50 shadow-[0_0_20px_rgba(156,163,175,0.15)]' : 'border-gray-800'}`}>
          {winner === 'B' && (
            <div className="absolute top-4 end-4 flex items-center gap-1.5 text-gray-300 bg-gray-500/10 px-3 py-1 rounded-full text-sm font-medium">
              <Trophy size={16} />
              <span>الأفضل أداءً</span>
            </div>
          )}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-gray-700/50 rounded-xl text-gray-300">
              <BarChart3 size={24} />
            </div>
            <h2 className="text-xl font-bold text-white">الترتيب الزمني (B)</h2>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800/50">
              <div className="text-gray-400 text-sm mb-1 flex items-center gap-1.5">
                <Search size={14} />
                عمليات البحث
              </div>
              <div className="text-2xl font-bold text-white">{variantB.total_searches}</div>
            </div>
            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800/50">
              <div className="text-gray-400 text-sm mb-1 flex items-center gap-1.5">
                <MousePointerClick size={14} />
                النقرات
              </div>
              <div className="text-2xl font-bold text-white">{variantB.total_clicks}</div>
            </div>
            <div className="bg-gray-700/20 p-4 rounded-xl border border-gray-600/30">
              <div className="text-gray-300 text-sm mb-1">نسبة النقر (CTR)</div>
              <div className="text-2xl font-bold text-gray-300">{variantB.ctr.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-6">نسبة النقر (CTR) بمرور الوقت</h3>
        <div className="h-[300px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} tickMargin={10} />
              <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} tickFormatter={(val) => `${val}%`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                itemStyle={{ color: '#E5E7EB' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Line 
                type="monotone" 
                dataKey="الخوارزمية الذكية (A)" 
                stroke="#14B8A6" 
                strokeWidth={3}
                dot={{ fill: '#14B8A6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
              <Line 
                type="monotone" 
                dataKey="الترتيب الزمني (B)" 
                stroke="#9CA3AF" 
                strokeWidth={3}
                dot={{ fill: '#9CA3AF', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Ranked Listings Table */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6 overflow-hidden flex flex-col">
          <h3 className="text-lg font-bold text-white mb-6">أفضل العقارات أداءً</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-start">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-sm">
                  <th className="pb-3 font-medium">العنوان</th>
                  <th className="pb-3 font-medium">نقاط الترتيب</th>
                  <th className="pb-3 font-medium">المشاهدات</th>
                  <th className="pb-3 font-medium">الرسائل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50 text-gray-300">
                {stats.top_listings?.map((listing) => (
                  <tr key={listing.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 font-medium text-white">{listing.title}</td>
                    <td className="py-3 text-brand-400 font-bold">{listing.score.toFixed(1)}</td>
                    <td className="py-3">{listing.views}</td>
                    <td className="py-3">{listing.messages}</td>
                  </tr>
                ))}
                {(!stats.top_listings || stats.top_listings.length === 0) && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500">
                      لا توجد بيانات متاحة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Zero Results Queries */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col">
          <h3 className="text-lg font-bold text-white mb-6">عمليات بحث بدون نتائج</h3>
          <div className="flex flex-wrap gap-2">
            {stats.zero_results_queries?.map((query, idx) => (
              <span 
                key={idx} 
                className="px-3 py-1.5 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg text-sm"
              >
                {query}
              </span>
            ))}
            {(!stats.zero_results_queries || stats.zero_results_queries.length === 0) && (
              <div className="text-gray-500 text-center w-full py-4">
                لا توجد بيانات متاحة
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
