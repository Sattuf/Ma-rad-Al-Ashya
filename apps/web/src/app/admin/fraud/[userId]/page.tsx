'use client';

import { errorMessage } from '@/lib/errors';
import React, { useEffect, useState } from 'react';
import { fraudApi } from '@/lib/api/fraud';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, ShieldAlert, AlertTriangle, Lock, Flag } from 'lucide-react';
import Link from 'next/link';

export default function FraudUserDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [riskData, setRiskData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [actionResult, setActionResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!userId) return;
    
    const fetchRisk = async () => {
      try {
        const data = await fraudApi.getRiskDetails(userId);
        setRiskData(data);
      } catch (error) {
        console.error('Error fetching risk details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRisk();
  }, [userId]);

  const handleAction = async (actionType: 'flag' | 'lock') => {
    if (!reason.trim()) {
      setActionResult({ ok: false, text: 'اكتب سبب الإجراء أولاً؛ يُحفظ في سجل المراجعة.' });
      return;
    }
    setActionLoading(actionType);
    setActionResult(null);
    try {
      await fraudApi.takeAction(userId, actionType, reason.trim());
      setActionResult({ ok: true, text: actionType === 'lock' ? 'أُوقف الحساب، ولن يستطيع صاحبه تسجيل الدخول.' : 'سُجّل الحساب كمشبوه وسيبقى تحت المراقبة.' });
      setReason('');
      setRiskData(await fraudApi.getRiskDetails(userId));
    } catch (err) {
      // The server only answers 2xx when the action really happened.
      setActionResult({ ok: false, text: errorMessage(err, 'لم يُنفَّذ الإجراء. حاول مجدداً.') });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-white">جارٍ التحميل…</div>;
  }

  if (!riskData) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400 mb-4">تعذر العثور على بيانات المخاطر لهذا المستخدم</p>
        <Link href="/admin/fraud" className="text-primary hover:underline">العودة للوحة التحكم</Link>
      </div>
    );
  }

  const score = riskData.risk_score || riskData.score || 0;
  const factors = riskData.risk_factors || riskData.factors || [];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-500';
    if (score >= 50) return 'text-orange-500';
    return 'text-green-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/admin/fraud')}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400"
          >
            <ArrowRight size={20} />
          </button>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="text-primary" />
            تفاصيل المخاطر للمستخدم
          </h1>
        </div>
        <div className="text-sm text-gray-400">
          معرف المستخدم: <span className="text-gray-300 font-mono">{userId}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Risk Score Card */}
        <div className="bg-gray-950 rounded-xl border border-gray-800 p-6 flex flex-col items-center justify-center text-center">
          <h2 className="text-gray-400 mb-2">درجة الخطورة (Risk Score)</h2>
          <div className={`text-6xl font-bold mb-4 ${getScoreColor(score)}`}>
            {score}
          </div>
          <p className="text-sm text-gray-500">
            {score >= 80 ? 'خطورة عالية جداً' : score >= 50 ? 'خطورة متوسطة' : 'خطورة منخفضة'}
          </p>
        </div>

        {/* Risk Factors Card */}
        <div className="bg-gray-950 rounded-xl border border-gray-800 p-6 md:col-span-2">
          <h2 className="text-lg font-semibold text-white mb-4">عوامل الخطورة المكتشفة</h2>
          {factors.length === 0 ? (
            <p className="text-gray-500 text-center py-8">لا توجد عوامل خطورة مسجلة</p>
          ) : (
            <ul className="space-y-3">
              {factors.map((factor: any, idx: number) => (
                <li key={idx} className="flex items-start gap-3 bg-gray-900 p-3 rounded-lg border border-gray-800">
                  <AlertTriangle className="text-orange-500 mt-0.5" size={18} />
                  <div>
                    <p className="text-gray-200 font-medium">{factor.description || factor.type || factor}</p>
                    {factor.timestamp && (
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(factor.timestamp).toLocaleString('ar-SA')}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-gray-950 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">الإجراءات المتاحة</h2>
        <label htmlFor="action-reason" className="mb-1 block text-sm text-gray-300">سبب الإجراء (مطلوب)</label>
        <textarea
          id="action-reason"
          rows={2}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="مثال: عشرة إعلانات متطابقة خلال ساعة من أجهزة مختلفة."
          className="mb-4 w-full rounded-lg border border-gray-700 bg-gray-900 p-3 text-sm text-gray-100"
        />
        {actionResult && (
          <p role={actionResult.ok ? 'status' : 'alert'} className={`mb-4 rounded-lg p-3 text-sm ${actionResult.ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
            {actionResult.text}
          </p>
        )}
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => handleAction('flag')}
            disabled={actionLoading !== null}
            className="flex items-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 px-4 py-2.5 rounded-lg transition-colors"
          >
            <Flag size={18} />
            تحديد كمشبوه (Flag)
            {actionLoading === 'flag' && <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full me-2"></span>}
          </button>
          
          <button
            onClick={() => handleAction('lock')}
            disabled={actionLoading !== null}
            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-4 py-2.5 rounded-lg transition-colors"
          >
            <Lock size={18} />
            قفل الحساب (Lock Account)
            {actionLoading === 'lock' && <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full me-2"></span>}
          </button>
        </div>
      </div>
    </div>
  );
}
