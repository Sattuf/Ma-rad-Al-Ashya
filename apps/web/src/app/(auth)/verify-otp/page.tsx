'use client';

import { errorMessage } from '@/lib/errors';
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth-store';
import Cookies from 'js-cookie';

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') || '';
  const setAuth = useAuthStore((state) => state.setAuth);

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [activeOtpIndex, setActiveOtpIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!phone) {
      router.push('/login');
    }
  }, [phone, router]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeOtpIndex]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const intervalId = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [timeLeft]);

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const { value } = e.target;
    if (!/^[0-9]*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    if (value && index < 5) {
      setActiveOtpIndex(index + 1);
    } else if (value && index === 5) {
      const code = newOtp.join('');
      if (code.length === 6) {
        verifyCode(code);
      }
    }
  };

  const handleOnKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      if (index > 0) setActiveOtpIndex(index - 1);
    }
  };

  const verifyCode = async (code: string) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      const res = await authApi.verifyOtp({ phone, code });
      
      localStorage.setItem('access_token', res.tokens.access_token);
      Cookies.set('refresh_token', res.tokens.refresh_token, { expires: 7, secure: true, sameSite: 'strict' });
      
      setAuth(res.user, res.tokens.access_token);
      router.push('/');
    } catch (err: any) {
      setError(errorMessage(err, 'رمز التحقق غير صحيح. تأكد من الأرقام وحاول مجدداً.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (timeLeft > 0) return;
    try {
      setError(null);
      await authApi.sendOtp(phone);
      setTimeLeft(60);
    } catch (err: any) {
      setError(errorMessage(err, 'تعذّر إرسال رمز جديد. حاول بعد دقيقة.'));
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 bg-primary-soft rounded-full flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </div>
      
      <h2 className="text-2xl font-bold text-gray-800 mb-2">التحقق من رقم الهاتف</h2>
      <p className="text-gray-500 text-center mb-8 dir-ltr text-sm">
        أدخل رمز التحقق المكون من 6 أرقام المرسل إلى<br />
        <span className="font-semibold text-gray-700">{phone}</span>
      </p>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 w-full text-sm border border-red-100 text-center">
          {error}
        </div>
      )}

      <div className="flex justify-center gap-2 mb-8" dir="ltr">
        {otp.map((_, index) => (
          <input
            key={index}
            ref={index === activeOtpIndex ? inputRef : null}
            type="text"
            className="w-12 h-14 border-2 rounded-xl text-center text-xl font-semibold text-gray-800 focus:border-primary focus:outline-none transition-colors"
            value={otp[index]}
            onChange={(e) => handleOnChange(e, index)}
            onKeyDown={(e) => handleOnKeyDown(e, index)}
            disabled={isSubmitting}
          />
        ))}
      </div>

      <div className="text-center">
        {isSubmitting ? (
          <div className="text-primary flex items-center justify-center text-sm font-medium">
            <svg className="animate-spin -me-1 ms-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            جارٍ التحقق…
          </div>
        ) : (
          <button
            onClick={handleResend}
            disabled={timeLeft > 0}
            className={`text-sm font-medium transition-colors ${
              timeLeft > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-primary hover:text-primary-hover'
            }`}
          >
            {timeLeft > 0 ? `إعادة إرسال الرمز خلال ${timeLeft} ثانية` : 'لم يصلك الرمز؟ إعادة الإرسال'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="text-center py-10">جارٍ التحميل…</div>}>
      <VerifyOtpContent />
    </Suspense>
  );
}
