'use client';

import { ErrorState } from '@/components/ui';
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Edit2, Mail, Phone, MapPin, Calendar, ShieldCheck, Star } from 'lucide-react';
import { userApi, type Profile } from '@/lib/api/users';

type UserProfile = Profile & {
  phone?: string;
  role?: string;
  rating?: number;
  ratingCount?: number;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await userApi.getProfile();
        setProfile(data);
      } catch (error) {
        setLoadError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!profile) {
    return <ErrorState error={loadError} title="تعذّر تحميل ملفك الشخصي" onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="bg-surface rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header Cover */}
      <div className="h-32 bg-gradient-to-r from-brand-700 to-brand-700"></div>
      
      <div className="px-8 pb-8 relative">
        {/* Avatar & Action */}
        <div className="flex justify-between items-end -mt-12 mb-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-4 border-white bg-surface overflow-hidden shadow-md">
              <Image
                src={profile.avatar || '/placeholder-avatar.png'}
                alt={profile.name}
                width={96}
                height={96}
                className="object-cover w-full h-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(profile.name) + '&background=random';
                }}
              />
            </div>
          </div>
          <Link
            href="/profile/edit"
            className="flex items-center gap-2 bg-primary-soft text-primary px-4 py-2 rounded-xl hover:bg-primary-soft transition-colors font-medium text-sm"
          >
            <Edit2 className="w-4 h-4" />
            تعديل
          </Link>
        </div>

        {/* User Info */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{profile.name}</h1>
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-3">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            <span>{profile.role === 'admin' ? 'مدير النظام' : 'مستخدم'}</span>
            {profile.isIdentityVerified ? (
              <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold border border-green-200">
                <ShieldCheck className="w-3 h-3" />
                موثّق ✓
              </span>
            ) : (
              <Link href="/profile/verify" className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 hover:bg-amber-100 px-2 py-0.5 rounded-full text-xs font-medium border border-amber-200 transition-colors">
                وثّق حسابك
              </Link>
            )}
          </div>
          {/* Rating Summary Section */}
          <div className="flex items-center gap-2 bg-gray-50 inline-flex px-3 py-1.5 rounded-lg border border-gray-100">
            <div className="flex text-yellow-400">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className={`w-4 h-4 ${star <= Math.round(profile.rating || 0) ? 'fill-current' : 'text-gray-300'}`} />
              ))}
            </div>
            <span className="font-medium text-gray-900 me-1">{(profile.rating || 0).toFixed(1)}</span>
            <span className="text-gray-500 text-sm">({profile.ratingCount || 0} تقييم)</span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
            <div className="p-3 bg-surface rounded-xl shadow-sm text-primary">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">البريد الإلكتروني</p>
              <p className="font-medium text-gray-900">{profile.email || 'غير متوفر'}</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
            <div className="p-3 bg-surface rounded-xl shadow-sm text-primary">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">رقم الهاتف</p>
              <p className="font-medium text-gray-900" dir="ltr">{profile.phone || 'غير متوفر'}</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
            <div className="p-3 bg-surface rounded-xl shadow-sm text-primary">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">الموقع</p>
              <p className="font-medium text-gray-900">{profile.location || 'غير متوفر'}</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
            <div className="p-3 bg-surface rounded-xl shadow-sm text-primary">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">تاريخ الانضمام</p>
              <p className="font-medium text-gray-900">
                {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('ar-SA') : 'غير متوفر'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
