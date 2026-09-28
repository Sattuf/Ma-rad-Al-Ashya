'use client';

import { use, useState, useEffect } from 'react';
import { adminApi, Report } from '@/lib/api/admin';
import Link from 'next/link';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ArrowRight, AlertTriangle, User, FileText, CheckCircle, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { errorMessage } from '@/lib/errors';

export default function AdminReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Review form state
  const [status, setStatus] = useState<Report['status']>('pending');
  const [actionTaken, setActionTaken] = useState<NonNullable<Report['actionTaken']>>('none');
  const [adminNote, setAdminNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    adminApi.getReport(resolvedParams.id)
      .then(data => {
        setReport(data);
        setStatus(data.status);
        setActionTaken(data.actionTaken || 'none');
        setAdminNote(data.adminNote || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [resolvedParams.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!report) return;
    
    setIsSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');
    
    try {
      await adminApi.reviewReport(report.id, {
        status,
        actionTaken,
        adminNote: adminNote.trim() || undefined
      });
      setSuccessMsg('حُفظت المراجعة، ونُفّذ الإجراء المختار.');
      // Refresh
      const updated = await adminApi.getReport(resolvedParams.id);
      setReport(updated);
    } catch (err) {
      setErrorMsg(errorMessage(err, 'تعذّر حفظ المراجعة. لم يتغيّر شيء؛ حاول مجدداً.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">لم يتم العثور على البلاغ</p>
        <Link href="/admin/reports" className="text-primary mt-4 inline-block hover:underline">
          العودة للقائمة
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link 
          href="/admin/reports" 
          className="p-2 bg-gray-800 text-gray-400 hover:text-white rounded-lg transition-colors"
        >
          <ArrowRight size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-white">تفاصيل البلاغ #{report.id.substring(0, 8)}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Report Info */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-6">
          <div className="flex items-center gap-3 text-amber-500 mb-2">
            <AlertTriangle size={24} />
            <h2 className="text-xl font-bold text-white">معلومات البلاغ</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">السبب</p>
              <p className="text-white font-medium bg-gray-900/50 p-3 rounded-lg border border-gray-700">{report.reason}</p>
            </div>
            
            {report.description && (
              <div>
                <p className="text-gray-400 text-sm mb-1">تفاصيل إضافية</p>
                <p className="text-white bg-gray-900/50 p-3 rounded-lg border border-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {report.description}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-sm mb-1">النوع</p>
                <p className="text-white">{report.targetType === 'listing' ? 'إعلان' : 'مستخدم'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">تاريخ الإبلاغ</p>
                <p className="text-white text-sm" dir="ltr">
                  {report.createdAt ? format(new Date(report.createdAt), 'PP p', { locale: ar }) : ''}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-700">
              <p className="text-gray-400 text-sm mb-2">المحتوى المُبلّغ عنه</p>
              <Link 
                href={report.targetType === 'listing' ? `/listings/${report.targetId}` : `/users/${report.targetId}`}
                target="_blank"
                className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg border border-gray-700 hover:border-brand-600/50 transition-colors group"
              >
                <span className="text-white group-hover:text-brand-400 transition-colors line-clamp-1">
                  {report.targetInfo?.title || report.targetInfo?.name || `رقم: ${report.targetId}`}
                </span>
                <Eye size={16} className="text-gray-500 group-hover:text-brand-400" />
              </Link>
            </div>
          </div>
        </div>

        {/* Review Action */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center gap-3 text-primary mb-6">
            <FileText size={24} />
            <h2 className="text-xl font-bold text-white">المراجعة والإجراء</h2>
          </div>

          {errorMsg && (
            <div role="alert" className="mb-6 rounded-lg border border-danger bg-danger-soft p-4 text-danger">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div role="status" className="mb-6 p-4 bg-brand-600/10 border border-brand-600/20 rounded-lg flex items-center gap-3 text-primary">
              <CheckCircle size={20} />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-gray-400 text-sm mb-2">الحالة</label>
              <select 
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 outline-none focus:border-primary transition-colors"
              >
                <option value="pending">معلق</option>
                <option value="reviewed">قيد المراجعة</option>
                <option value="resolved">تم الحل</option>
                <option value="dismissed">مرفوض</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">الإجراء المتخذ</label>
              <select 
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value as any)}
                className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 outline-none focus:border-primary transition-colors"
              >
                <option value="none">لا يوجد إجراء</option>
                <option value="warning">توجيه إنذار</option>
                {report.targetType === 'listing' && <option value="listing_removed">حذف الإعلان</option>}
                <option value="user_suspended">إيقاف المستخدم مؤقتاً</option>
                <option value="user_banned">حظر المستخدم نهائياً</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">ملاحظات الإدارة (داخلية)</label>
              <textarea 
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={4}
                className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-3 outline-none focus:border-primary transition-colors resize-none"
                placeholder="أضف ملاحظات تفصيلية عن الإجراء المتخذ..."
              />
            </div>

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-primary hover:bg-primary text-on-primary rounded-lg font-medium transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
            >
              {isSubmitting ? 'جارٍ الحفظ…' : 'حفظ الإجراء'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
