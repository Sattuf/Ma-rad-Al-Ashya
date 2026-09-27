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
import { Alert, Button, Input } from '@/components/ui';

const loginSchema = z.object({
  identifier: z.string().min(1, 'مطلوب إدخال البريد الإلكتروني أو رقم الهاتف'),
  password: z.string().min(1, 'أدخل كلمة المرور'),
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
      <h2 className="text-2xl font-bold text-fg mb-6 text-center">تسجيل الدخول</h2>
      
      {error && (
        <Alert tone="danger" className="mb-6">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="البريد الإلكتروني أو رقم الهاتف"
          {...register('identifier')}
          type="text"
          autoComplete="username"
          dir="ltr"
          placeholder="example@mail.com أو +966..."
          error={errors.identifier?.message}
        />

        <Input
          label="كلمة المرور"
          {...register('password')}
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
        />

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          {isSubmitting ? 'جارٍ تسجيل الدخول…' : 'تسجيل الدخول'}
        </Button>
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
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="h-5 w-5 me-2" />
          <span className="text-gray-700 font-medium">جوجل</span>
        </button>
        <button
          onClick={handleFacebookLogin}
          type="button"
          className="flex items-center justify-center w-full px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <img src="https://www.svgrepo.com/show/475647/facebook-color.svg" alt="Facebook" className="h-5 w-5 me-2" />
          <span className="text-gray-700 font-medium">فيسبوك</span>
        </button>
      </div>

      <p className="mt-8 text-center text-sm text-gray-600">
        ليس لديك حساب؟{' '}
        <Link href="/register" className="font-bold text-primary hover:text-primary-hover transition-colors">
          إنشاء حساب جديد
        </Link>
      </p>
    </div>
  );
}
