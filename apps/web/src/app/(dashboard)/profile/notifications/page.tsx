'use client';

import { Alert } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import React, { useEffect, useState } from 'react';
import { Bell, Smartphone, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { userApi, type NotificationSettings } from '@/lib/api/users';

// The categories users-service stores (notification_messages/listings/transactions).
const CATEGORIES: { key: keyof NotificationSettings; title: string; description: string; icon: typeof Bell }[] = [
  { key: 'messages', title: 'الرسائل', description: 'عندما يراسلك مشترٍ أو بائع بشأن إعلان.', icon: Mail },
  { key: 'transactions', title: 'الصفقات', description: 'عند طلب شراء، أو تأكيد، أو إلغاء صفقة تخصك.', icon: Smartphone },
  { key: 'listings', title: 'الإعلانات', description: 'تحديثات إعلاناتك: انتهاء المدة، البلاغات، والتفاعل.', icon: Bell },
];

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    messages: true,
    listings: true,
    transactions: true,
  });
  
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<keyof NotificationSettings | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await userApi.getProfile();
        setSettings(profile.notifications);
      } catch (error) {
        setNotice(errorMessage(error, 'تعذّر تحميل إعداداتك الحالية.'));
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleToggle = async (key: keyof NotificationSettings) => {
    const newValue = !settings[key];
    
    // Optimistic UI update
    setSettings((prev) => ({ ...prev, [key]: newValue }));
    setUpdating(key);
    
    try {
      await userApi.updateNotifications({ [key]: newValue });
    } catch (error) {
      setNotice(errorMessage(error, 'لم يُحفظ التغيير. حاول مجدداً.'));
      // Revert on failure
      setSettings((prev) => ({ ...prev, [key]: !newValue }));
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-3xl shadow-sm border border-gray-100 p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">إعدادات الإشعارات</h1>
        <p className="text-gray-500 mt-1">اختر ما يصلك من تنبيهات.</p>
      </div>
      {notice && <Alert tone="danger" className="mb-6">{notice}</Alert>}

      <div className="space-y-6">
        {CATEGORIES.map(({ key, title, description, icon: Icon }) => (
          <div
            key={key}
            className="flex items-start justify-between p-5 rounded-2xl border border-gray-100 bg-gray-50/50 transition-colors"
          >
            <div className="flex gap-4">
              <div className="p-3 bg-surface rounded-xl shadow-sm text-primary shrink-0 h-fit">
                <Icon className="w-6 h-6" aria-hidden />
              </div>
              <div>
                <h3 id={`notif-${key}`} className="font-semibold text-gray-900 text-lg mb-1">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
              </div>
            </div>
            <div className="pt-2 pe-2">
              <button
                onClick={() => handleToggle(key)}
                disabled={updating === key}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                  settings[key] ? 'bg-primary' : 'bg-gray-300'
                } disabled:opacity-50`}
                role="switch"
                aria-checked={settings[key]}
                aria-labelledby={`notif-${key}`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none flex items-center justify-center h-6 w-6 transform rounded-full bg-surface shadow-sm ring-0 transition duration-200 ease-in-out ${
                    settings[key] ? '-translate-x-5' : 'translate-x-0'
                  }`}
                >
                  {updating === key && <Loader2 className="w-3 h-3 text-primary animate-spin" />}
                </span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-brand-50/50 rounded-2xl border border-brand-100 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-primary leading-relaxed">
          رسائل الأمان (مثل رموز التحقق وتسجيل الدخول من جهاز جديد) تصلك دائماً ولا يمكن إيقافها.
        </p>
      </div>
    </div>
  );
}
