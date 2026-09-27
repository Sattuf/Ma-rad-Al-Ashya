'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loadStripe, type Appearance } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { ArrowRight, Check, ImageOff, ShieldCheck } from 'lucide-react';
import { useListingDetail } from '@/hooks/useListings';
import { promotionsApi, type PromotionPlan } from '@/lib/api/promotions';
import { Alert, Button, Card, ErrorState, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { coverImage, formatPrice } from '@/types/listing';

// No fallback key: without a real publishable key the payment step is disabled, not faked.
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

/** Stripe renders in an iframe, so pass it the resolved design tokens (light or dark). */
function stripeAppearance(): Appearance {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    theme: 'stripe',
    variables: {
      colorPrimary: token('--color-primary', '#0f766e'),
      colorBackground: token('--color-surface', '#ffffff'),
      colorText: token('--color-fg', '#1f2937'),
      colorDanger: token('--color-danger', '#b91c1c'),
      borderRadius: '10px',
    },
  };
}

function CheckoutForm({ plan, onSuccess }: { plan: PromotionPlan; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    if (stripeError) {
      setError(stripeError.message ?? 'تعذّر إتمام الدفع. لم يُخصم أي مبلغ.');
    } else if (paymentIntent && ['succeeded', 'processing'].includes(paymentIntent.status)) {
      // The promotion is activated server-side by the Stripe webhook.
      onSuccess();
      return;
    } else {
      setError('لم تكتمل عملية الدفع. لم يُخصم أي مبلغ، يمكنك المحاولة مجدداً.');
    }
    setProcessing(false);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" fullWidth loading={processing} disabled={!stripe}>
        ادفع {formatPrice(plan.price, plan.currency)} وفعّل الترويج
      </Button>
    </form>
  );
}

export default function PromoteListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: listingId } = use(params);
  const router = useRouter();
  const { listing, isLoading: listingLoading } = useListingDetail(listingId);

  const [plans, setPlans] = useState<PromotionPlan[] | null>(null);
  const [plansError, setPlansError] = useState(false);
  const [selected, setSelected] = useState<PromotionPlan | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  const loadPlans = () => {
    setPlansError(false);
    setPlans(null);
    promotionsApi
      .getPlans()
      .then((data) => {
        setPlans(data);
        setSelected(data.find((p) => p.id === 'featured') ?? data[0] ?? null);
      })
      .catch(() => setPlansError(true));
  };
  useEffect(loadPlans, []);

  const startPayment = async () => {
    if (!selected) return;
    setStarting(true);
    setPaymentError(null);
    try {
      const { clientSecret } = await promotionsApi.createPaymentIntent(listingId, selected);
      setClientSecret(clientSecret);
    } catch (err: any) {
      setPaymentError(err?.response?.data?.message ?? 'تعذّر الاتصال ببوابة الدفع الآن. لم يُخصم أي مبلغ، حاول بعد قليل.');
    } finally {
      setStarting(false);
    }
  };

  const onPaid = () => {
    setPaid(true);
    setTimeout(() => router.push('/my-listings'), 3000);
  };

  if (listingLoading) {
    return (
      <main className="container mx-auto max-w-5xl px-4 py-8">
        <Skeleton className="mb-6 h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="container mx-auto px-4 py-16">
        <Card>
          <ErrorState title="الإعلان غير موجود أو حُذف" description="ربما حُذف الإعلان أو تغيّر رابطه." />
          <div className="pb-6 text-center">
            <Link href="/my-listings" className="inline-flex items-center gap-2 text-primary hover:underline">
              <ArrowRight className="h-4 w-4" aria-hidden /> العودة إلى إعلاناتي
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  const image = coverImage(listing);

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <nav aria-label="مسار التنقل" className="mb-6 flex items-center gap-2 text-sm text-fg-muted">
        <Link href="/my-listings" className="hover:text-primary">إعلاناتي</Link>
        <span aria-hidden>/</span>
        <span className="text-fg">ترويج الإعلان</span>
      </nav>

      {paid ? (
        <Card className="mx-auto max-w-xl p-10 text-center" role="status">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-pill bg-success-soft text-success">
            <ShieldCheck className="h-8 w-8" aria-hidden />
          </span>
          <h1 className="mb-2 text-2xl font-bold text-fg">تم الدفع بنجاح</h1>
          <p className="text-fg-muted">
            سيُفعَّل ترويج «{listing.title}» خلال لحظات بعد تأكيد الدفع. سننقلك إلى إعلاناتك…
          </p>
        </Card>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <div>
              <h1 className="mb-2 text-2xl font-bold text-fg">روّج إعلانك</h1>
              <p className="text-fg-muted">يظهر الإعلان المروَّج في مرتبة أعلى في نتائج البحث طوال مدة الخطة.</p>
            </div>

            {plansError ? (
              <Card>
                <ErrorState title="تعذّر تحميل خطط الترويج" onRetry={loadPlans} />
              </Card>
            ) : !plans ? (
              <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-72" />
                ))}
              </div>
            ) : (
              <div role="radiogroup" aria-label="خطط الترويج" className="grid gap-4 md:grid-cols-3">
                {plans.map((plan) => {
                  const isSelected = selected?.id === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={!!clientSecret}
                      onClick={() => setSelected(plan)}
                      className={cn(
                        'relative flex flex-col gap-4 rounded-card border-2 bg-surface p-5 text-start transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-60',
                        isSelected ? 'border-primary' : 'border-line hover:border-line-strong',
                      )}
                    >
                      {plan.id === 'featured' && (
                        <span className="absolute -top-3 start-4 rounded-pill bg-primary px-2.5 py-0.5 text-xs font-semibold text-on-primary">
                          الأكثر اختياراً
                        </span>
                      )}
                      <div>
                        <p className="text-lg font-bold text-fg">{plan.name}</p>
                        <p className="text-sm text-fg-muted">{plan.description}</p>
                      </div>
                      <p className="text-2xl font-extrabold text-fg">{formatPrice(plan.price, plan.currency)}</p>
                      <ul className="flex flex-col gap-2 border-t border-line pt-4 text-sm text-fg-muted">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
            )}

            {selected && plans && (
              <Card className="flex flex-col gap-4 p-6">
                {paymentError && <Alert tone="danger">{paymentError}</Alert>}
                {!stripePromise ? (
                  <Alert tone="warning">الدفع الإلكتروني غير متاح حالياً. حاول لاحقاً.</Alert>
                ) : !clientSecret ? (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-fg">خطة {selected.name}</p>
                      <p className="text-sm text-fg-muted">
                        المبلغ: <span className="font-bold text-fg">{formatPrice(selected.price, selected.currency)}</span> — دفعة واحدة، بلا اشتراك.
                      </p>
                    </div>
                    <Button onClick={startPayment} loading={starting}>متابعة إلى الدفع</Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between border-b border-line pb-4">
                      <h2 className="font-semibold text-fg">بيانات الدفع</h2>
                      <Button variant="ghost" size="sm" onClick={() => setClientSecret(null)}>تغيير الخطة</Button>
                    </div>
                    <Elements stripe={stripePromise} options={{ clientSecret, locale: 'ar', appearance: stripeAppearance() }}>
                      <CheckoutForm plan={selected} onSuccess={onPaid} />
                    </Elements>
                  </>
                )}
              </Card>
            )}
          </div>

          <aside className="flex flex-col gap-6">
            <Card className="flex items-center gap-3 p-5">
              {image ? (
                <img src={image} alt="" className="h-20 w-20 shrink-0 rounded-control object-cover" />
              ) : (
                <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-control bg-surface-muted text-fg-subtle">
                  <ImageOff className="h-6 w-6" aria-hidden />
                </span>
              )}
              <div className="min-w-0">
                <p className="line-clamp-2 font-semibold text-fg">{listing.title}</p>
                <p className="font-bold text-primary">{formatPrice(listing.price, listing.currency)}</p>
              </div>
            </Card>
            <Card className="flex flex-col gap-3 p-5 text-sm text-fg-muted">
              <p className="flex items-center gap-2 font-semibold text-fg">
                <ShieldCheck className="h-5 w-5 text-primary" aria-hidden /> دفع آمن
              </p>
              <p>تتم المعالجة عبر Stripe، ولا نخزّن بيانات بطاقتك.</p>
              <p>لا يبدأ الترويج إلا بعد تأكيد الدفع، وإن فشل الدفع فلن يُخصم شيء.</p>
            </Card>
          </aside>
        </div>
      )}
    </main>
  );
}
