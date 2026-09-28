'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Check, ImageOff, ShieldCheck, Star } from 'lucide-react';
import { useDealDetails, useTransaction } from '@/hooks/useTransactions';
import { transactionsApi } from '@/lib/api/transactions';
import { useAuthStore } from '@/lib/store/auth-store';
import { Alert, Badge, Button, Card, ErrorState, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { dealStatusLabel } from '@/lib/deals';
import { errorMessage } from '@/lib/errors';
import { coverImage, formatPrice } from '@/types/listing';

const STEPS = [
  { id: 'pending_seller', title: 'يؤكد البائع' },
  { id: 'pending_buyer', title: 'يستلم المشتري ويؤكد' },
  { id: 'completed', title: 'تمّت الصفقة' },
] as const;

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useAuthStore((s) => s.user?.id);
  const { transaction: deal, isLoading, error, mutate } = useTransaction(id);
  const { listings, people } = useDealDetails(deal ? [deal] : [], me);

  const [busy, setBusy] = useState<'confirm' | 'cancel' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [reviewState, setReviewState] = useState<{ kind: 'idle' | 'sending' | 'sent' } | { kind: 'error'; message: string }>({ kind: 'idle' });

  if (isLoading) {
    return (
      <main className="container mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
      </main>
    );
  }
  if (error || !deal) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-16">
        <Card>
          <ErrorState error={error} title="تعذّر فتح الصفقة" onRetry={() => mutate()} />
        </Card>
      </main>
    );
  }

  const role = deal.sellerId === me ? 'seller' : 'buyer';
  const listing = listings?.get(deal.listingId);
  const other = people?.get(role === 'buyer' ? deal.sellerId : deal.buyerId);
  const status = dealStatusLabel(deal.status, role);
  const stepIndex = STEPS.findIndex((s) => s.id === deal.status);
  const canConfirm = (deal.status === 'pending_seller' && role === 'seller') || (deal.status === 'pending_buyer' && role === 'buyer');
  const canCancel = deal.status === 'pending_seller' || deal.status === 'pending_buyer';
  const image = listing ? coverImage(listing) : null;

  const act = async (kind: 'confirm' | 'cancel') => {
    setBusy(kind);
    setActionError(null);
    try {
      if (kind === 'confirm') await transactionsApi.confirmTransaction(deal.id);
      else await transactionsApi.cancelTransaction(deal.id);
      setConfirmingCancel(false);
      await mutate();
    } catch (err) {
      setActionError(errorMessage(err, kind === 'confirm' ? 'تعذّر تأكيد الصفقة. حاول مجدداً.' : 'تعذّر إلغاء الصفقة. حاول مجدداً.'));
    } finally {
      setBusy(null);
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) {
      setReviewState({ kind: 'error', message: 'اختر عدد النجوم أولاً.' });
      return;
    }
    setReviewState({ kind: 'sending' });
    try {
      await transactionsApi.createReview(deal.id, rating, comment.trim() || undefined);
      setReviewState({ kind: 'sent' });
    } catch (err) {
      setReviewState({ kind: 'error', message: errorMessage(err, 'تعذّر نشر تقييمك. حاول مجدداً.') });
    }
  };

  const nextStepHint =
    deal.status === 'pending_seller'
      ? role === 'seller'
        ? 'أكّد أنك ما زلت تبيع هذه السلعة، ثم اتفق مع المشتري على موعد ومكان التسليم.'
        : 'بانتظار تأكيد البائع. يمكنك مراسلته لترتيب الموعد.'
      : deal.status === 'pending_buyer'
        ? role === 'buyer'
          ? 'بعد أن تستلم السلعة وتفحصها، أكّد الاستلام لإتمام الصفقة.'
          : 'بانتظار أن يستلم المشتري السلعة ويؤكد.'
        : null;

  return (
    <main className="container mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <nav aria-label="مسار التنقل" className="text-sm text-fg-muted">
        <Link href="/transactions" className="hover:text-primary">صفقاتي</Link> <span aria-hidden>/</span> <span className="text-fg">تفاصيل الصفقة</span>
      </nav>

      <Card className="flex items-center gap-4 p-5">
        {image ? (
          <img src={image} alt="" className="h-20 w-20 shrink-0 rounded-control object-cover" />
        ) : (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-control bg-surface-muted text-fg-subtle">
            <ImageOff className="h-6 w-6" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-fg">
            {listing ? <Link href={`/listings/${listing.id}`} className="hover:text-primary">{listing.title}</Link> : listings ? 'إعلان محذوف' : '…'}
          </h1>
          {listing && <p className="font-bold text-primary">{formatPrice(listing.price, listing.currency)}</p>}
          <p className="text-sm text-fg-muted">
            {role === 'buyer' ? 'البائع' : 'المشتري'}:{' '}
            {other ? <Link href={`/users/${other.id}`} className="hover:text-primary">{other.name || 'مستخدم'}</Link> : '…'}
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </Card>

      {deal.status === 'cancelled' ? (
        <Alert tone="danger">
          أُلغيت هذه الصفقة{deal.cancelledBy ? (deal.cancelledBy === me ? ' بطلب منك' : ` بطلب من ${role === 'buyer' ? 'البائع' : 'المشتري'}`) : ''}.
          {deal.cancelReason && ` السبب: ${deal.cancelReason}`}
        </Alert>
      ) : (
        <Card className="p-5">
          <ol className="grid grid-cols-3 gap-2" aria-label="مراحل الصفقة">
            {STEPS.map((step, i) => {
              const done = i < stepIndex || deal.status === 'completed';
              const current = i === stepIndex && deal.status !== 'completed';
              return (
                <li key={step.id} aria-current={current ? 'step' : undefined} className="flex flex-col items-center gap-2 text-center">
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-pill text-sm font-semibold',
                      done ? 'bg-primary text-on-primary' : current ? 'bg-primary-soft text-on-primary-soft ring-2 ring-primary' : 'bg-surface-muted text-fg-muted',
                    )}
                  >
                    {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
                  </span>
                  <span className={cn('text-sm', current ? 'font-semibold text-fg' : 'text-fg-muted')}>{step.title}</span>
                </li>
              );
            })}
          </ol>
          {nextStepHint && <p className="mt-4 text-center text-sm text-fg-muted">{nextStepHint}</p>}
        </Card>
      )}

      {actionError && <Alert tone="danger">{actionError}</Alert>}

      {(canConfirm || canCancel) && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {canCancel &&
            (confirmingCancel ? (
              <div role="alertdialog" aria-label="تأكيد الإلغاء" className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-fg">إلغاء الصفقة نهائياً؟</span>
                <Button variant="danger" size="sm" loading={busy === 'cancel'} onClick={() => act('cancel')}>نعم، ألغِ الصفقة</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmingCancel(false)}>تراجع</Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setConfirmingCancel(true)} disabled={busy !== null}>إلغاء الصفقة</Button>
            ))}
          {canConfirm && (
            <Button loading={busy === 'confirm'} onClick={() => act('confirm')} disabled={busy === 'cancel'}>
              <Check className="h-4 w-4" aria-hidden /> {role === 'seller' ? 'أؤكد البيع' : 'استلمت السلعة'}
            </Button>
          )}
        </div>
      )}

      {deal.status !== 'completed' && deal.status !== 'cancelled' && (
        <p className="flex items-start gap-2 text-sm text-fg-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          للأمان: التقيا في مكان عام، وافحص السلعة قبل الدفع، ولا تحوّل أي مبلغ مقدماً.
        </p>
      )}

      {deal.status === 'completed' && (
        <Card className="p-5">
          {reviewState.kind === 'sent' ? (
            <p role="status" className="text-center text-fg">شكراً! نُشر تقييمك ويساعد الآخرين على الثقة.</p>
          ) : (
            <form onSubmit={submitReview} className="flex flex-col gap-4">
              <h2 className="font-semibold text-fg">قيّم {role === 'buyer' ? 'البائع' : 'المشتري'}</h2>
              <fieldset>
                <legend className="mb-2 text-sm text-fg-muted">كيف كانت تجربتك؟</legend>
                <div className="flex gap-1" role="radiogroup" aria-label="عدد النجوم">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={`${n} من 5`}
                      onClick={() => setRating(n)}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-control focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      <Star className={cn('h-7 w-7', n <= rating ? 'fill-current text-warning' : 'text-line-strong')} aria-hidden />
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-col gap-1">
                <label htmlFor="comment" className="text-sm font-medium text-fg">تعليق (اختياري)</label>
                <textarea
                  id="comment"
                  rows={3}
                  maxLength={500}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="هل كانت السلعة كما في الوصف؟ هل كان التواصل سهلاً؟"
                  className="rounded-control border border-line bg-surface px-4 py-3 text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-focus-ring"
                />
                <p className="text-end text-xs text-fg-subtle">{comment.length} / 500</p>
              </div>
              {reviewState.kind === 'error' && <Alert tone="danger">{reviewState.message}</Alert>}
              <Button type="submit" loading={reviewState.kind === 'sending'} className="self-start">نشر التقييم</Button>
            </form>
          )}
        </Card>
      )}
    </main>
  );
}
