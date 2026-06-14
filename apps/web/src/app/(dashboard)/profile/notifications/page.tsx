'use client';

import React, { useEffect, useState } from 'react';
import { Bell, Smartphone, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { userApi } from '@/lib/api/users';

interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
}

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
  });
  
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<keyof NotificationSettings | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await userApi.getProfile();
        const user = data.user || data;
        if (user.notifications) {
          setSettings(user.notifications);
        }
      } catch (error) {
        console.error('Failed to fetch profile', error);
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
      console.error('Failed to update notifications', error);
      // Revert on failure
      setSettings((prev) => ({ ...prev, [key]: !newValue }));
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">إعدادات الإشعارات</h1>
        <p className="text-gray-500 mt-1">تحكم في كيفية تلقيك للإشعارات والتنبيهات</p>
      </div>

      <div className="space-y-6">
        {/* Email Notifications */}
        <div className="flex items-start justify-between p-5 rounded-2xl border border-gray-100 hover:border-blue-100 bg-gray-50/50 transition-colors">
          <div className="flex gap-4">
            <div className="p-3 bg-white rounded-xl shadow-sm text-blue-600 shrink-0 h-fit">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg mb-1">إشعارات البريد الإلكتروني</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                تلقي تحديثات حول حسابك، نشاطك، والعروض الخاصة عبر البريد الإلكتروني.
              </p>
            </div>
          </div>
          <div className="pt-2 pl-2">
            <button
              onClick={() => handleToggle('emailNotifications')}
              disabled={updating === 'emailNotifications'}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
                settings.emailNotifications ? 'bg-blue-600' : 'bg-gray-200'
              } disabled:opacity-50`}
              role="switch"
              aria-checked={settings.emailNotifications}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none flex items-center justify-center h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  settings.emailNotifications ? '-translate-x-5' : 'translate-x-0'
                }`}
              >
                {updating === 'emailNotifications' && (
                  <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                )}
              </span>
            </button>
          </div>
        </div>

        {/* Push Notifications */}
        <div className="flex items-start justify-between p-5 rounded-2xl border border-gray-100 hover:border-blue-100 bg-gray-50/50 transition-colors">
          <div className="flex gap-4">
            <div className="p-3 bg-white rounded-xl shadow-sm text-blue-600 shrink-0 h-fit">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg mb-1">إشعارات التطبيق (Push)</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                تلقي تنبيهات فورية على جهازك حول الرسائل الجديدة والتحديثات المهمة.
              </p>
            </div>
          </div>
          <div className="pt-2 pl-2">
            <button
              onClick={() => handleToggle('pushNotifications')}
              disabled={updating === 'pushNotifications'}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
                settings.pushNotifications ? 'bg-blue-600' : 'bg-gray-200'
              } disabled:opacity-50`}
              role="switch"
              aria-checked={settings.pushNotifications}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none flex items-center justify-center h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  settings.pushNotifications ? '-translate-x-5' : 'translate-x-0'
                }`}
              >
                {updating === 'pushNotifications' && (
                  <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                )}
              </span>
            </button>
          </div>
        </div>

        {/* SMS Notifications */}
        <div className="flex items-start justify-between p-5 rounded-2xl border border-gray-100 hover:border-blue-100 bg-gray-50/50 transition-colors">
          <div className="flex gap-4">
            <div className="p-3 bg-white rounded-xl shadow-sm text-blue-600 shrink-0 h-fit">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg mb-1">الرسائل النصية (SMS)</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                تلقي رسائل نصية قصيرة للتنبيهات العاجلة والأمان (مثل رموز التحقق).
              </p>
            </div>
          </div>
          <div className="pt-2 pl-2">
            <button
              onClick={() => handleToggle('smsNotifications')}
              disabled={updating === 'smsNotifications'}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
                settings.smsNotifications ? 'bg-blue-600' : 'bg-gray-200'
              } disabled:opacity-50`}
              role="switch"
              aria-checked={settings.smsNotifications}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none flex items-center justify-center h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  settings.smsNotifications ? '-translate-x-5' : 'translate-x-0'
                }`}
              >
                {updating === 'smsNotifications' && (
                  <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                )}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 leading-relaxed">
          ملاحظة: بعض الإشعارات الهامة المتعلقة بأمان حسابك لا يمكن تعطيلها.
        </p>
      </div>
    </div>
  );
}
