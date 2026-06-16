'use client';

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useListingDetail } from '@/hooks/useListings';
import { promotionsApi, PromotionPlan, saveLocalPromotion } from '@/lib/api/promotions';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Check, CreditCard, Sparkles, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

// Initialize stripe outside component
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 
  'pk_test_51MzTquHGlR3gV1Z4fT7D8xNfB6Xp3G9L0Jm2K5s8P1q9V4Y3Z8R7T5S6D4F3G2H1J0K9L8M7N6P5Q4R3S2T1U'
);

function StripeCheckoutForm({ 
  listingId, 
  plan, 
  onSuccess 
}: { 
  listingId: string; 
  plan: PromotionPlan; 
  onSuccess: () => void 
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    // Standard Stripe payment confirmation
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message || 'حدث خطأ غير متوقع أثناء الدفع.');
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      // Save local promotion just to update UI for this demo/local environment
      saveLocalPromotion(listingId, plan.id, plan.durationDays);
      onSuccess();
    } else {
      // If redirected or other status
      saveLocalPromotion(listingId, plan.id, plan.durationDays);
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement options={{ layout: 'tabs' }} />
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {errorMessage}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-primary hover:bg-primary/95 text-white py-3 px-4 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary/20"
      >
        {isProcessing ? (
          <>
            <Loader2 className="animate-spin" size={20} />
            <span>جاري معالجة الدفع...</span>
          </>
        ) : (
          <span>دفع {plan.price} ر.س وتفعيل الترويج</span>
        )}
      </button>
    </form>
  );
}

function MockCheckoutForm({ 
  listingId, 
  plan, 
  onSuccess 
}: { 
  listingId: string; 
  plan: PromotionPlan; 
  onSuccess: () => void 
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = value.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      setCardNumber(parts.join(' '));
    } else {
      setCardNumber(value);
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/gi, '');
    if (value.length >= 2) {
      setExpiry(`${value.slice(0, 2)}/${value.slice(2, 4)}`);
    } else {
      setExpiry(value);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!cardNumber || cardNumber.length < 16) {
      setError('يرجى إدخال رقم بطاقة صالح');
      return;
    }
    if (!expiry || expiry.length < 5) {
      setError('يرجى إدخال تاريخ انتهاء صالح');
      return;
    }
    if (!cvc || cvc.length < 3) {
      setError('يرجى إدخال رمز التحقق (CVC) صالح');
      return;
    }
    if (!name) {
      setError('يرجى إدخال اسم حامل البطاقة');
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      saveLocalPromotion(listingId, plan.id, plan.durationDays);
      setIsProcessing(false);
      onSuccess();
    }, 1800);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-xs mb-4">
        ⚠️ <strong>وضع التجربة:</strong> يرجى استخدام أي بطاقة دفع تجريبية (مثال: 4242 4242 4242 4242).
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">اسم حامل البطاقة</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="محمد أحمد"
          className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-right"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">رقم البطاقة</label>
        <div className="relative">
          <input
            type="text"
            required
            maxLength={19}
            value={cardNumber}
            onChange={handleCardNumberChange}
            placeholder="4242 4242 4242 4242"
            className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ltr text-left"
          />
          <CreditCard className="absolute right-3 top-3.5 text-gray-400" size={18} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">تاريخ الانتهاء</label>
          <input
            type="text"
            required
            maxLength={5}
            value={expiry}
            onChange={handleExpiryChange}
            placeholder="MM/YY"
            className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-center ltr"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">رمز التحقق (CVC)</label>
          <input
            type="password"
            required
            maxLength={4}
            value={cvc}
            onChange={(e) => setCvc(e.target.value.replace(/[^0-9]/gi, ''))}
            placeholder="•••"
            className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-center ltr"
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isProcessing}
        className="w-full bg-primary hover:bg-primary/95 text-white py-3 px-4 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary/20"
      >
        {isProcessing ? (
          <>
            <Loader2 className="animate-spin" size={20} />
            <span>جاري معالجة الدفع التجريبي...</span>
          </>
        ) : (
          <span>دفع {plan.price} ر.س وتفعيل الترويج (تجريبي)</span>
        )}
      </button>
    </form>
  );
}

export default function PromoteListingPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const listingId = resolvedParams.id;

  const { listing, isLoading: isListingLoading } = useListingDetail(listingId);
  const [plans, setPlans] = useState<PromotionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PromotionPlan | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [isPlansLoading, setIsPlansLoading] = useState(true);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    async function loadPlans() {
      try {
        const data = await promotionsApi.getPlans();
        setPlans(data);
        // Pre-select Featured plan
        if (data.length > 1) {
          setSelectedPlan(data[1]);
        } else if (data.length > 0) {
          setSelectedPlan(data[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsPlansLoading(false);
      }
    }
    loadPlans();
  }, []);

  const handleSelectPlan = async (plan: PromotionPlan) => {
    setSelectedPlan(plan);
    setClientSecret(null);
  };

  const handleProceedToPayment = async () => {
    if (!selectedPlan) return;
    try {
      const res = await promotionsApi.createPaymentIntent(listingId, selectedPlan);
      setClientSecret(res.clientSecret);
      setIsMock(!!res.isMock);
    } catch (error) {
      alert('حدث خطأ أثناء الاتصال ببوابة الدفع.');
    }
  };

  const handleSuccess = () => {
    setPaymentSuccess(true);
    setTimeout(() => {
      router.push('/my-listings');
    }, 3000);
  };

  if (isListingLoading || isPlansLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Loader2 className="animate-spin mx-auto text-primary mb-4" size={40} />
        <p className="text-gray-500">جاري تحميل البيانات...</p>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-red-500 text-lg font-bold">العقار غير موجود أو تم حذفه.</p>
        <Link href="/my-listings" className="text-primary hover:underline inline-flex items-center gap-2 mt-4">
          <ArrowRight size={18} />
          <span>العودة إلى عقاراتي</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl text-right" dir="rtl">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/my-listings" className="hover:text-primary transition-colors">عقاراتي</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">ترويج العقار</span>
      </div>

      {paymentSuccess ? (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-12 text-center max-w-xl mx-auto space-y-6 my-12 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-500 shadow-inner">
            <ShieldCheck size={48} className="animate-bounce" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">تم تفعيل الترويج بنجاح!</h2>
          <p className="text-gray-600">
            شكرًا لك! إعلانك <strong>"{listing.title}"</strong> أصبح مروّجاً الآن وسيحصل على المزيد من التفاعل والمشاهدات فوراً.
          </p>
          <div className="text-sm text-gray-400 bg-gray-50 py-3 rounded-lg">
            جاري إعادة توجيهك إلى قائمة عقاراتك...
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Promotions Content */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span>روّج لإعلانك وضاعف مبيعاتك 🚀</span>
              </h1>
              <p className="text-gray-600">
                اختر الخطة الترويجية الأنسب لعقارك <strong>"{listing.title}"</strong> لضمان وصوله لأكبر عدد من المشترين المحتملين.
              </p>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const isSelected = selectedPlan?.id === plan.id;
                const isPremium = plan.id === 'premium';
                const isFeatured = plan.id === 'featured';

                return (
                  <div
                    key={plan.id}
                    onClick={() => handleSelectPlan(plan)}
                    className={`relative rounded-2xl border-2 p-5 flex flex-col justify-between cursor-pointer transition-all hover:shadow-md ${
                      isSelected
                        ? 'border-primary bg-primary/[0.02] shadow-sm shadow-primary/10'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {isFeatured && (
                      <span className="absolute -top-3 right-4 bg-primary text-white text-xs px-2.5 py-1 rounded-full font-bold shadow-sm">
                        الأكثر طلباً 🔥
                      </span>
                    )}
                    {isPremium && (
                      <span className="absolute -top-3 right-4 bg-gradient-to-r from-amber-500 to-yellow-600 text-white text-xs px-2.5 py-1 rounded-full font-bold shadow-sm flex items-center gap-1">
                        <Sparkles size={12} />
                        <span>ذهبي مميز</span>
                      </span>
                    )}

                    <div className="space-y-4">
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg mb-1">{plan.name}</h3>
                        <p className="text-xs text-gray-400">{plan.durationDays} أيام</p>
                      </div>

                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-gray-900">{plan.price}</span>
                        <span className="text-sm text-gray-500 font-semibold">ر.س</span>
                      </div>

                      <p className="text-sm text-gray-600 leading-relaxed min-h-[60px]">{plan.description}</p>

                      <ul className="space-y-2.5 border-t border-gray-100 pt-4 text-sm text-gray-600">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check size={16} className="text-primary mt-0.5 shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-6">
                      <button
                        type="button"
                        className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm transition-all text-center border ${
                          isSelected
                            ? 'bg-primary border-primary text-white shadow-sm'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {isSelected ? 'تم الاختيار' : 'اختيار الخطة'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Plan Details or Stripe Element Container */}
            {selectedPlan && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-6">
                {!clientSecret ? (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-gray-900">الخطة المختارة: {selectedPlan.name}</h4>
                      <p className="text-gray-500 text-sm">
                        المجموع الإجمالي للدفع: <span className="font-bold text-primary">{selectedPlan.price} ر.س</span>
                      </p>
                    </div>
                    <button
                      onClick={handleProceedToPayment}
                      className="bg-primary hover:bg-primary/95 text-white py-3 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-primary/10"
                    >
                      <span>الانتقال للدفع الآمن</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
                      <h4 className="font-bold text-gray-900 text-lg">بوابة الدفع الآمنة (Stripe)</h4>
                      <button
                        onClick={() => setClientSecret(null)}
                        className="text-gray-400 hover:text-gray-600 text-sm"
                      >
                        تغيير الخطة
                      </button>
                    </div>

                    {isMock ? (
                      <MockCheckoutForm 
                        listingId={listingId} 
                        plan={selectedPlan} 
                        onSuccess={handleSuccess} 
                      />
                    ) : (
                      <Elements 
                        stripe={stripePromise} 
                        options={{ 
                          clientSecret,
                          locale: 'ar',
                          appearance: {
                            theme: 'stripe',
                            variables: {
                              colorPrimary: '#0f766e', // Teal 700 matching typical premium look
                              colorBackground: '#ffffff',
                              colorText: '#1f2937',
                              borderRadius: '12px',
                            }
                          }
                        }}
                      >
                        <StripeCheckoutForm 
                          listingId={listingId} 
                          plan={selectedPlan} 
                          onSuccess={handleSuccess} 
                        />
                      </Elements>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-900">ملخص العقار</h3>
              <div className="flex gap-3 items-center">
                <img
                  src={listing.images[0] || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=200&q=80'}
                  alt=""
                  className="w-20 h-20 rounded-xl object-cover"
                />
                <div className="space-y-1">
                  <h4 className="font-bold text-gray-800 text-sm line-clamp-2">{listing.title}</h4>
                  <p className="text-gray-500 text-xs">{listing.location.city} • {listing.area} م²</p>
                  <p className="text-primary font-extrabold text-sm">{listing.price.toLocaleString()} ر.س</p>
                </div>
              </div>
            </div>

            <div className="bg-teal-50/50 rounded-2xl p-6 border border-teal-100/60 space-y-4 text-teal-950">
              <h4 className="font-bold flex items-center gap-2 text-teal-800">
                <ShieldCheck size={20} />
                <span>لماذا تروّج عقارك معنا؟</span>
              </h4>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-2">
                  <span className="text-teal-600 font-bold">•</span>
                  <span><strong>أسرع في البيع:</strong> العقارات المروجة تباع أسرع بـ 5 مرات مقارنة بالعادية.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-teal-600 font-bold">•</span>
                  <span><strong>وصول مضاعف:</strong> يظهر إعلانك للآلاف من زوار الصفحة الرئيسية وتصنيفات البحث فوراً.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-teal-600 font-bold">•</span>
                  <span><strong>تميز عن البقية:</strong> تمنحك شارة الترويج مصداقية إضافية وتلفت الانتباه فوراً.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
