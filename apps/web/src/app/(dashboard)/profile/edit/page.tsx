'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';
import { Camera, Loader2, Save } from 'lucide-react';
import { userApi } from '@/lib/api/users';

const profileSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يكون أكثر من حرفين'),
  email: z.string().email('البريد الإلكتروني غير صحيح'),
  phone: z.string().min(9, 'رقم الهاتف قصير جداً'),
  location: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function EditProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await userApi.getProfile();
        const user = data.user || data;
        setValue('name', user.name || '');
        setValue('email', user.email || '');
        setValue('phone', user.phone || '');
        setValue('location', user.location || '');
        if (user.avatar) setAvatarPreview(user.avatar);
      } catch (error) {
        console.error('Failed to fetch profile', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [setValue]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    try {
      setUploadingAvatar(true);
      // Create preview
      const objectUrl = URL.createObjectURL(file);
      setAvatarPreview(objectUrl);

      // Compress image
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);
      setAvatarFile(compressedFile);
    } catch (error) {
      console.error('Error compressing image:', error);
    } finally {
      setUploadingAvatar(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/webp': [],
    },
    maxFiles: 1,
  });

  const onSubmit = async (data: ProfileFormValues) => {
    try {
      setSaving(true);
      
      // Upload avatar first if changed
      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        await userApi.uploadAvatar(formData);
      }

      // Update profile info
      await userApi.updateProfile(data);
      router.push('/profile');
    } catch (error) {
      console.error('Failed to update profile', error);
      // Handle error state here
    } finally {
      setSaving(false);
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
        <h1 className="text-2xl font-bold text-gray-900">تعديل البيانات</h1>
        <p className="text-gray-500 mt-1">قم بتحديث معلومات حسابك الشخصية</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Avatar Upload */}
        <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6 pb-8 border-b border-gray-100">
          <div {...getRootProps()} className="relative cursor-pointer group">
            <input {...getInputProps()} />
            <div className={`w-32 h-32 rounded-full border-4 ${isDragActive ? 'border-blue-500' : 'border-gray-50'} bg-gray-100 overflow-hidden relative shadow-sm transition-colors`}>
              {avatarPreview ? (
                <Image
                  src={avatarPreview}
                  alt="Avatar preview"
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                  <Camera className="w-8 h-8 mb-1" />
                </div>
              )}
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-8 h-8 text-white mb-1" />
                <span className="text-white text-xs font-medium">تغيير الصورة</span>
              </div>
            </div>
          </div>
          <div className="text-center sm:text-start pt-4">
            <h3 className="font-medium text-gray-900 mb-1">صورة الملف الشخصي</h3>
            <p className="text-sm text-gray-500">JPG, PNG أو WebP. الحد الأقصى 1MB.</p>
          </div>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">الاسم الكامل</label>
            <input
              {...register('name')}
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors outline-none text-gray-900"
              placeholder="أدخل اسمك الكامل"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">البريد الإلكتروني</label>
            <input
              {...register('email')}
              type="email"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors outline-none text-gray-900"
              placeholder="example@domain.com"
              dir="ltr"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">رقم الهاتف</label>
            <input
              {...register('phone')}
              type="tel"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors outline-none text-gray-900 text-right"
              placeholder="+966 5X XXX XXXX"
              dir="ltr"
            />
            {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">الموقع</label>
            <input
              {...register('location')}
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors outline-none text-gray-900"
              placeholder="المدينة، الدولة"
            />
            {errors.location && <p className="text-red-500 text-sm mt-1">{errors.location.message}</p>}
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t border-gray-100">
          <button
            type="submit"
            disabled={saving || uploadingAvatar}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-xl hover:opacity-90 transition-opacity font-medium disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            حفظ التغييرات
          </button>
        </div>
      </form>
    </div>
  );
}
