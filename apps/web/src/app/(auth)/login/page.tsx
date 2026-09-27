'use client';

import { errorMessage } from '@/lib/errors';
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
import { SocialLogin } from '@/components/auth/SocialLogin';
import { safeNext } from '@/lib/safe-next';

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
      router.replace(safeNext(new URLSearchParams(window.location.search).get('next')));
    } catch (err: any) {
      setError(errorMessage(err, 'تعذّر تسجيل الدخول. تأكد من البيانات وحاول مجدداً.'));
    }
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
          placeholder="البريد أو رقم الهاتف مع رمز الدولة"
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

      <SocialLogin />

      <p className="mt-8 text-center text-sm text-fg-muted">
        ليس لديك حساب؟{' '}
        <Link href="/register" className="font-bold text-primary hover:text-primary-hover transition-colors">
          إنشاء حساب جديد
        </Link>
      </p>
    </div>
  );
}
