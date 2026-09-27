'use client';

import { useState, useEffect } from 'react';
import { adminApi, Report } from '@/lib/api/admin';
import Link from 'next/link';
import { Search, Filter, AlertCircle, Eye, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

const STATUS_MAP = {
  pending: { label: 'معلق', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: AlertCircle },
  reviewed: { label: 'قيد المراجعة', color: 'bg-brand-600/10 text-primary border-brand-600/20', icon: Eye },
  resolved: { label: 'تم الحل', color: 'bg-brand-600/10 text-primary border-brand-600/20', icon: CheckCircle },
  dismissed: { label: 'مرفوض', color: 'bg-gray-500/10 text-gray-500 border-gray-500/20', icon: XCircle },
};

const TARGET_TYPE_MAP = {
  listing: 'إعلان',
  user: 'مستخدم',
};

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  // Linked from the dashboard as /admin/reports?status=pending (read once, client-side).
  const [statusFilter, setStatusFilter] = useState(() =>
    typeof window === 'undefined' ? '' : (new URLSearchParams(window.location.search).get('status') ?? ''),
  );
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchReports = () => {
    setLoading(true);
    adminApi.getReports(statusFilter || undefined, typeFilter || undefined, page, 15)
      .then((res: any) => {
        setReports(res.data || []);
        if (res.meta) setTotalPages(res.meta.lastPage || 1);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReports();
  }, [statusFilter, typeFilter, page]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold text-white">البلاغات</h1>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <select 
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:border-primary transition-colors"
          >
            <option value="">جميع الحالات</option>
            <option value="pending">معلق</option>
            <option value="reviewed">قيد المراجعة</option>
            <option value="resolved">تم الحل</option>
            <option value="dismissed">مرفوض</option>
          </select>

          <select 
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:border-primary transition-colors"
          >
            <option value="">جميع الأنواع</option>
            <option value="listing">إعلانات</option>
            <option value="user">مستخدمين</option>
          </select>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="bg-gray-900/50 text-gray-400">
              <tr>
                <th className="p-4 font-medium">الرقم</th>
                <th className="p-4 font-medium">المحتوى</th>
                <th className="p-4 font-medium">النوع</th>
                <th className="p-4 font-medium">السبب</th>
                <th className="p-4 font-medium">الحالة</th>
                <th className="p-4 font-medium">التاريخ</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">لا توجد بلاغات مطابقة</td>
                </tr>
              ) : (
                reports.map(report => {
                  const statusInfo = STATUS_MAP[report.status];
                  const StatusIcon = statusInfo.icon;
                  
                  return (
                    <tr key={report.id} className="hover:bg-gray-700/30 transition-colors">
                      <td className="p-4 text-gray-400 font-mono text-xs">
                        {report.id.substring(0, 8)}
                      </td>
                      <td className="p-4 text-white">
                        <span className="line-clamp-1 max-w-[200px]">
                          {report.targetInfo?.title || report.targetInfo?.name || report.targetId}
                        </span>
                      </td>
                      <td className="p-4 text-gray-300">
                        {TARGET_TYPE_MAP[report.targetType]}
                      </td>
                      <td className="p-4 text-gray-300">
                        {report.reason}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                          <StatusIcon size={12} />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400">
                        {report.createdAt ? formatDistanceToNow(new Date(report.createdAt), { addSuffix: true, locale: ar }) : ''}
                      </td>
                      <td className="p-4 text-end">
                        <Link 
                          href={`/admin/reports/${report.id}`}
                          className="inline-flex items-center justify-center px-3 py-1.5 bg-primary hover:bg-primary text-on-primary rounded text-xs font-medium transition-colors"
                        >
                          التفاصيل
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination (Simple) */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button 
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded disabled:opacity-50"
          >
            السابق
          </button>
          <span className="px-4 py-2 text-gray-400">
            صفحة {page} من {totalPages}
          </span>
          <button 
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded disabled:opacity-50"
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
