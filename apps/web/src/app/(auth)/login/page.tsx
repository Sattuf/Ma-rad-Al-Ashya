'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth-store';
import Cookies from 'js-cookie';

const loginSchema = z.object({
  identifier: z.string().min(1, 'مطلوب إدخال البريد الإلكتروني أو رقم الهاتف'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      setError(null);
      const res = await authApi.login(data);
      
      localStorage.setItem('access_token', res.tokens.access_token);
      Cookies.set('refresh_token', res.tokens.refresh_token, { expires: 7, secure: true, sameSite: 'strict' });
      
      setAuth(res.user, res.tokens.access_token);
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'حدث خطأ غير متوقع أثناء تسجيل الدخول');
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:3000/api/v1/auth/google';
  };

  const handleFacebookLogin = () => {
    window.location.href = 'http://localhost:3000/api/v1/auth/facebook';
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">تسجيل الدخول</h2>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm border border-red-100">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني أو رقم الهاتف</label>
          <input
            id="identifier"
            {...register('identifier')}
            type="text"
            className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all ${
              errors.identifier ? 'border-red-500' : 'border-gray-200'
            }`}
            placeholder="example@mail.com أو +966..."
          />
          {errors.identifier && <p className="text-red-500 text-xs mt-1">{errors.identifier.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
          <input
            id="password"
            {...register('password')}
            type="password"
            className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all ${
              errors.password ? 'border-red-500' : 'border-gray-200'
            }`}
            placeholder="••••••••"
          />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold py-3 px-4 rounded-xl transition-all disabled:opacity-70 shadow-md"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              جاري تسجيل الدخول...
            </span>
          ) : (
            'تسجيل الدخول'
          )}
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between">
        <hr className="w-full border-gray-200" />
        <span className="px-3 text-sm text-gray-400 whitespace-nowrap">أو الدخول بواسطة</span>
        <hr className="w-full border-gray-200" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <button
          onClick={handleGoogleLogin}
          type="button"
          className="flex items-center justify-center w-full px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="h-5 w-5 ml-2" />
          <span className="text-gray-700 font-medium">جوجل</span>
        </button>
        <button
          onClick={handleFacebookLogin}
          type="button"
          className="flex items-center justify-center w-full px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <img src="https://www.svgrepo.com/show/475647/facebook-color.svg" alt="Facebook" className="h-5 w-5 ml-2" />
          <span className="text-gray-700 font-medium">فيسبوك</span>
        </button>
      </div>

      <p className="mt-8 text-center text-sm text-gray-600">
        ليس لديك حساب؟{' '}
        <Link href="/register" className="font-bold text-teal-600 hover:text-teal-500 transition-colors">
          إنشاء حساب جديد
        </Link>
      </p>
    </div>
  );
}
