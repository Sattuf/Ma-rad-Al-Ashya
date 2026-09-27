'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MapPin, Upload, X, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Map from '@/components/Map';
import { listingsApi } from '@/lib/api/listings';
import { useRouter } from 'next/navigation';

const listingSchema = z.object({
  title: z.string().min(5, 'العنوان يجب أن يكون 5 أحرف على الأقل'),
  description: z.string().min(20, 'الوصف يجب أن يكون 20 حرف على الأقل'),
  price: z.coerce.number().min(1, 'السعر مطلوب'),
  type: z.enum(['sale', 'rent']),
  propertyType: z.enum(['apartment', 'house', 'villa', 'land', 'commercial']),
  bedrooms: z.coerce.number().optional(),
  bathrooms: z.coerce.number().optional(),
  area: z.coerce.number().min(1, 'المساحة مطلوبة'),
});

type ListingFormData = z.infer<typeof listingSchema>;

const STEPS = [
  { id: 1, title: 'المعلومات الأساسية' },
  { id: 2, title: 'تفاصيل العقار' },
  { id: 3, title: 'الصور' },
  { id: 4, title: 'الموقع' },
];

function SortableItem({ id, url, onRemove }: { id: string; url: string; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative group rounded-xl overflow-hidden aspect-video bg-gray-100 cursor-move">
      <img src={url} alt="Listing preview" className="w-full h-full object-cover" />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(id);
        }}
        className="absolute top-2 start-2 p-1 bg-surface/80 hover:bg-red-500 hover:text-white rounded-full transition-colors opacity-0 group-hover:opacity-100"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default function CreateListingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [images, setImages] = useState<{ id: string; url: string; file?: File }[]>([]);
  const [location, setLocation] = useState({ lat: 24.7136, lng: 46.6753, address: '', city: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, trigger, watch } = useForm<any>({
    resolver: zodResolver(listingSchema),
    defaultValues: { type: 'sale', propertyType: 'apartment' },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDrop = (acceptedFiles: File[]) => {
    const newImages = acceptedFiles.slice(0, 10 - images.length).map(file => ({
      id: Math.random().toString(36).substring(7),
      url: URL.createObjectURL(file),
      file,
    }));
    setImages(prev => [...prev, ...newImages]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 10,
    disabled: images.length >= 10,
  });

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const nextStep = async () => {
    let isValid = false;
    if (currentStep === 1) isValid = await trigger(['title', 'description', 'price', 'type']);
    if (currentStep === 2) isValid = await trigger(['propertyType', 'area', 'bedrooms', 'bathrooms']);
    if (currentStep === 3) isValid = images.length > 0;
    
    if (isValid) setCurrentStep(prev => prev + 1);
  };

  const onSubmit = async (data: any) => {
    if (images.length === 0) return;
    if (!location.address || !location.city) return alert('الرجاء إدخال المدينة والحي');

    setIsSubmitting(true);
    try {
      // In a real app, upload files first and get URLs
      const uploadedUrls = images.map(img => img.url); // Mocked
      
      const payload = {
        ...data,
        images: uploadedUrls,
        location,
        features: [],
        status: 'active' as const,
      };

      const res = await listingsApi.createListing(payload);
      router.push(`/listings/${res.id}`);
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء إضافة العقار');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">إضافة عقار جديد</h1>
        {/* Stepper */}
        <div className="flex items-center justify-between relative">
          <div className="absolute end-0 start-0 top-1/2 h-0.5 bg-gray-200 -z-10" />
          {STEPS.map((step, idx) => (
            <div key={step.id} className="flex flex-col items-center bg-surface px-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mb-2 transition-colors ${
                currentStep > step.id ? 'bg-primary text-white' :
                currentStep === step.id ? 'bg-primary text-white ring-4 ring-primary/20' :
                'bg-gray-100 text-gray-400'
              }`}>
                {currentStep > step.id ? <Check size={20} /> : step.id}
              </div>
              <span className={`text-sm ${currentStep >= step.id ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                {step.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
        <form onSubmit={handleSubmit(onSubmit)}>
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">نوع الإعلان</label>
                <div className="flex gap-4">
                  <label className={`flex-1 p-4 rounded-lg border-2 cursor-pointer text-center transition-colors ${
                    watch('type') === 'sale' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 hover:border-primary/50'
                  }`}>
                    <input type="radio" value="sale" {...register('type')} className="sr-only" />
                    <span className="font-medium">للبيع</span>
                  </label>
                  <label className={`flex-1 p-4 rounded-lg border-2 cursor-pointer text-center transition-colors ${
                    watch('type') === 'rent' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 hover:border-primary/50'
                  }`}>
                    <input type="radio" value="rent" {...register('type')} className="sr-only" />
                    <span className="font-medium">للإيجار</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">عنوان الإعلان</label>
                <input
                  {...register('title')}
                  className="w-full rounded-lg border-gray-300 border p-3 focus:ring-primary focus:border-primary"
                  placeholder="مثال: فيلا فاخرة للبيع في حي الياسمين"
                />
                {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message as string}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">السعر (ر.س)</label>
                <input
                  type="number"
                  {...register('price')}
                  className="w-full rounded-lg border-gray-300 border p-3 focus:ring-primary focus:border-primary"
                />
                {errors.price && <p className="text-red-500 text-sm mt-1">{errors.price.message as string}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">وصف العقار</label>
                <textarea
                  {...register('description')}
                  rows={5}
                  className="w-full rounded-lg border-gray-300 border p-3 focus:ring-primary focus:border-primary"
                  placeholder="اكتب تفاصيل العقار ومميزاته..."
                />
                {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description.message as string}</p>}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">نوع العقار</label>
                <select
                  {...register('propertyType')}
                  className="w-full rounded-lg border-gray-300 border p-3 focus:ring-primary focus:border-primary"
                >
                  <option value="apartment">شقة</option>
                  <option value="house">بيت / دور</option>
                  <option value="villa">فيلا</option>
                  <option value="land">أرض</option>
                  <option value="commercial">تجاري</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">المساحة (م²)</label>
                  <input
                    type="number"
                    {...register('area')}
                    className="w-full rounded-lg border-gray-300 border p-3 focus:ring-primary focus:border-primary"
                  />
                  {errors.area && <p className="text-red-500 text-sm mt-1">{errors.area.message as string}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">عدد غرف النوم</label>
                  <input
                    type="number"
                    {...register('bedrooms')}
                    className="w-full rounded-lg border-gray-300 border p-3 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">دورات المياه</label>
                  <input
                    type="number"
                    {...register('bathrooms')}
                    className="w-full rounded-lg border-gray-300 border p-3 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                    isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'
                  } ${images.length >= 10 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input {...getInputProps()} />
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-700 font-medium mb-1">
                    اسحب وأفلت الصور هنا، أو انقر لاختيار الصور
                  </p>
                  <p className="text-gray-500 text-sm">
                    الحد الأقصى 10 صور (بصيغة JPG, PNG)
                  </p>
                </div>
                {images.length === 0 && (
                  <p className="text-red-500 text-sm mt-2 text-center">الرجاء إضافة صورة واحدة على الأقل</p>
                )}
              </div>

              {images.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={images.map(i => i.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
                      {images.map((image) => (
                        <SortableItem key={image.id} id={image.id} url={image.url} onRemove={removeImage} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">المدينة</label>
                  <input
                    value={location.city}
                    onChange={(e) => setLocation({ ...location, city: e.target.value })}
                    className="w-full rounded-lg border-gray-300 border p-3 focus:ring-primary focus:border-primary"
                    placeholder="الرياض"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الحي / الشارع</label>
                  <input
                    value={location.address}
                    onChange={(e) => setLocation({ ...location, address: e.target.value })}
                    className="w-full rounded-lg border-gray-300 border p-3 focus:ring-primary focus:border-primary"
                    placeholder="حي الياسمين"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">حدد الموقع على الخريطة</label>
                <Map position={location} onPositionChange={(pos) => setLocation(prev => ({ ...prev, ...pos }))} />
                <p className="text-sm text-gray-500 mt-2 flex items-center">
                  <MapPin size={16} className="me-1" />
                  انقر على الخريطة لتحديد موقع العقار بدقة
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mt-10 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setCurrentStep(prev => prev - 1)}
              disabled={currentStep === 1}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowRight size={18} />
              <span>السابق</span>
            </button>

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                className="flex items-center gap-2 px-8 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                <span>التالي</span>
                <ArrowLeft size={18} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-8 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-70"
              >
                {isSubmitting ? 'جاري الإضافة...' : 'نشر العقار'}
                <Check size={18} />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
