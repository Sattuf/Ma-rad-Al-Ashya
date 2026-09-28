'use client';

import { errorMessage } from '@/lib/errors';
import React, { useState } from 'react';
import { useKycStatus } from '@/hooks/useKycStatus';
import { identityApi } from '@/lib/api/identity';
import { ShieldCheck, FileText, UserSquare2, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function VerifyIdentityPage() {
  const { status, isLoading } = useKycStatus();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartVerification = async () => {
    setIsStarting(true);
    setError(null);
    try {
      const response = await identityApi.startKyc();
      if (response.verification_url) {
        window.open(response.verification_url, '_blank');
      } else {
        setError('تعذّر تجهيز رابط التوثيق. حاول مجدداً.');
      }
    } catch (err) {
      setError(errorMessage(err, 'تعذّر بدء توثيق الهوية. حاول مجدداً.'));
    } finally {
      setIsStarting(false);
    }
  };

  const getStep = () => {
    if (status === 'approved') return 3;
    if (status === 'declined') return 3;
    if (status === 'session_created' || status === 'processing' || status === 'pending') return 2;
    return 1;
  };

  const currentStep = getStep();

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8 flex items-center gap-4">
        <Link href="/profile" className="text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowRight className="w-6 h-6" />
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">توثيق الهوية</h1>
      </div>

      <div className="bg-surface rounded-2xl shadow-sm border border-gray-100 p-8">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-12 relative">
          <div className="absolute end-0 start-0 top-1/2 h-0.5 bg-gray-100 -z-10 -translate-y-1/2"></div>
          
          <div className="flex flex-col items-center gap-2 bg-surface px-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${currentStep >= 1 ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
              <FileText className="w-6 h-6" />
            </div>
            <span className={`text-sm font-medium ${currentStep >= 1 ? 'text-primary' : 'text-gray-500'}`}>الوثائق</span>
          </div>

          <div className="flex flex-col items-center gap-2 bg-surface px-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${currentStep >= 2 ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
              <UserSquare2 className="w-6 h-6" />
            </div>
            <span className={`text-sm font-medium ${currentStep >= 2 ? 'text-primary' : 'text-gray-500'}`}>التعرف على الوجه</span>
          </div>

          <div className="flex flex-col items-center gap-2 bg-surface px-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${currentStep >= 3 ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span className={`text-sm font-medium ${currentStep >= 3 ? 'text-primary' : 'text-gray-500'}`}>النتيجة</span>
          </div>
        </div>

        {/* Content */}
        <div className="text-center min-h-[300px] flex flex-col justify-center items-center">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-gray-500">جارٍ التحقق من حالة التوثيق…</p>
            </div>
          ) : (
            <>
              {status === 'approved' && (
                <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">وُثّقت هويتك</h2>
                  <p className="text-gray-500 max-w-md">
                    شكراً لك. لقد تم التحقق من هويتك بنجاح ويمكنك الآن الاستفادة من كافة ميزات المنصة كبائع موثّق.
                  </p>
                  <Link href="/profile" className="mt-6 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl font-medium transition-colors">
                    العودة للملف الشخصي
                  </Link>
                </div>
              )}

              {status === 'declined' && (
                <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <XCircle className="w-10 h-10 text-red-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">لم نتمكّن من توثيق هويتك</h2>
                  <p className="text-gray-500 max-w-md">
                    غالباً السبب صورة غير واضحة أو وثيقة منتهية. صوّر الوثيقة في إضاءة جيدة دون انعكاس، وتأكد من صلاحيتها، ثم حاول مجدداً.
                  </p>
                  <button 
                    onClick={handleStartVerification}
                    disabled={isStarting}
                    className="mt-6 px-8 py-3 bg-primary hover:bg-primary text-on-primary rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isStarting && <Loader2 className="w-5 h-5 animate-spin" />}
                    إعادة المحاولة
                  </button>
                </div>
              )}

              {(status === 'session_created' || status === 'processing' || status === 'pending') && (
                <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
                  <div className="w-20 h-20 bg-primary-soft rounded-full flex items-center justify-center mb-4">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">جارٍ التحقق من هويتك</h2>
                  <p className="text-gray-500 max-w-md mb-2">
                    أكمل الخطوات في النافذة التي فُتحت. ستتحدّث هذه الصفحة وحدها عند الانتهاء.
                  </p>
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 text-amber-800 text-sm max-w-md">
                    أبقِ هذه الصفحة مفتوحة حتى يكتمل التوثيق.
                  </div>
                  <button 
                    onClick={handleStartVerification}
                    disabled={isStarting}
                    className="mt-4 px-6 py-2 bg-surface border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-colors disabled:opacity-50 text-sm"
                  >
                    إعادة فتح رابط التوثيق
                  </button>
                </div>
              )}

              {(status === 'unverified' || !status) && (
                <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <ShieldCheck className="w-10 h-10 text-gray-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">ابدأ عملية التوثيق</h2>
                  <p className="text-gray-500 max-w-md text-center">
                    للحصول على شارة &quot;بائع موثّق&quot;، نحتاج للتحقق من هويتك باستخدام وثيقة رسمية سارية المفعول (هوية وطنية، إقامة، أو جواز سفر) وصورة شخصية (سيلفي).
                  </p>
                  
                  {error && (
                    <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-100 text-sm max-w-md w-full">
                      {error}
                    </div>
                  )}

                  <button 
                    onClick={handleStartVerification}
                    disabled={isStarting}
                    className="mt-6 px-8 py-3 bg-primary hover:bg-primary text-on-primary rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isStarting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        جارٍ تجهيز الرابط…
                      </>
                    ) : (
                      'بدء التوثيق الآن'
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
