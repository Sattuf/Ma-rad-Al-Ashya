'use client';

import { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { reportsApi } from '@/lib/api/reports';
import { isAxiosError } from 'axios';

interface ReportDialogProps {
  targetType: 'listing' | 'user';
  targetId: string;
  onClose: () => void;
}

const REASONS = [
  'إعلان مزعج',
  'مزيف',
  'غير لائق',
  'احتيال',
  'مسيء',
  'تصنيف خاطئ',
  'أخرى',
];

export function ReportDialog({ targetType, targetId, onClose }: ReportDialogProps) {
  const [reason, setReason] = useState(REASONS[0]);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await reportsApi.createReport({
        targetType,
        targetId,
        reason,
        description: description.trim() || undefined,
      });
      setSuccess(true);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        setError('لقد قمت بالإبلاغ عن هذا المحتوى مسبقاً');
      } else {
        setError('حدث خطأ أثناء إرسال البلاغ. حاول مرة أخرى.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" dir="rtl">
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={20} />
            <h2 className="text-lg font-semibold">الإبلاغ عن {targetType === 'listing' ? 'إعلان' : 'مستخدم'}</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">تم إرسال البلاغ بنجاح</h3>
            <p className="text-gray-500 mb-6">شكراً لك على مساعدتنا في الحفاظ على بيئة آمنة.</p>
            <button 
              onClick={onClose}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition-colors"
            >
              إغلاق
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                سبب البلاغ
              </label>
              <select 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                تفاصيل إضافية (اختياري)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                rows={4}
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                placeholder="يرجى تزويدنا بمزيد من التفاصيل..."
              />
              <div className="text-left mt-1 text-xs text-gray-500">
                {description.length}/500
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition-colors"
              >
                إلغاء
              </button>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
              >
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                إرسال البلاغ
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
