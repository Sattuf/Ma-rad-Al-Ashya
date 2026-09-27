'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { BadgeCheck, Eye, Flag, Heart, ImageOff, MessageCircle, Pencil, Rocket, Share2, ShoppingCart } from 'lucide-react';
import { useListingDetail } from '@/hooks/useListings';
import { useFavoriteCheck } from '@/hooks/useFavorite';
import { useAuthStore } from '@/lib/store/auth-store';
import { transactionsApi } from '@/lib/api/transactions';
import { messagingApi } from '@/lib/api/messaging';
import { userApi } from '@/lib/api/users';
import { trackEvent } from '@/lib/analytics';
import RelatedListings from '@/components/listings/RelatedListings';
import { ReportDialog } from '@/components/moderation/ReportDialog';
import { Alert, Badge, Button, Card, ErrorState, Skeleton } from '@/components/ui';
import { formatPrice } from '@/types/listing';
import { cn } from '@/lib/cn';

const dateFormat = new Intl.DateTimeFormat('ar', { dateStyle: 'medium' });

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { listing, isLoading, error, mutate } = useListingDetail(id);
  const { user, isAuthenticated } = useAuthStore();
  const { isFavorite, toggleFavorite } = useFavoriteCheck(id);
  const { data: seller } = useSWR(listing ? `/users/${listing.userId}` : null, () => userApi.getUser(listing!.userId));
  const [activeImage, setActiveImage] = useState(0);
  const [busy, setBusy] = useState<'buy' | 'message' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);

  useEffect(() => {
    if (listing) trackEvent('view', { listingId: listing.id, categoryId: listing.categoryId ?? undefined });
  }, [listing]);

  if (isLoading) {
    return (
      <main className="container mx-auto px-4 py-8" aria-busy="true">
        <Skeleton className="mb-8 aspect-[16/9] w-full md:aspect-[21/9]" />
        <Skeleton className="mb-3 h-8 w-2/3" />
        <Skeleton className="h-6 w-1/4" />
      </main>
    );
  }

  if (error || !listing) {
    const notFound = error?.response?.status === 404 || error?.response?.status === 400;
    return (
      <main className="container mx-auto px-4 py-16">
        <Card>
          <ErrorState
            title={notFound ? 'هذا الإعلان غير متاح' : 'تعذّر تحميل الإعلان'}
            description={notFound ? 'ربما باعه صاحبه أو حذفه. تصفّح إعلانات أخرى مشابهة.' : undefined}
            onRetry={notFound ? undefined : () => mutate()}
          />
          {notFound && (
            <div className="pb-8 text-center">
              <Link href="/listings" className="font-medium text-primary">تصفّح الإعلانات</Link>
            </div>
          )}
        </Card>
      </main>
    );
  }

  const images = [...listing.images].sort((a, b) => a.sortOrder - b.sortOrder);
  const isOwner = user?.id === listing.userId;
  const canBuy = !isOwner && listing.status === 'active';

  const requireLogin = () => router.push(`/login?next=/listings/${listing.id}`);

  const buy = async () => {
    if (!isAuthenticated) return requireLogin();
    setBusy('buy');
    setNotice(null);
    try {
      const tx = await transactionsApi.createTransaction(listing.id, listing.userId);
      router.push(`/transactions/${tx.id}`);
    } catch (err: any) {
      setNotice({
        tone: 'danger',
        text: err?.response?.status === 409 ? 'أرسلت طلب شراء لهذا الإعلان مسبقاً. تابعه من صفحة صفقاتي.' : 'تعذّر إرسال طلب الشراء، حاول مجدداً.',
      });
      setBusy(null);
    }
  };

  const message = async () => {
    if (!isAuthenticated) return requireLogin();
    setBusy('message');
    try {
      const conversation = await messagingApi.startConversation(listing.userId, listing.id);
      router.push(`/messages?c=${conversation.id}`);
    } catch {
      setNotice({ tone: 'danger', text: 'تعذّر فتح المحادثة، حاول مجدداً.' });
      setBusy(null);
    }
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: listing.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setNotice({ tone: 'success', text: 'نُسخ رابط الإعلان.' });
      }
    } catch {
      // user cancelled the share sheet
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      {/* Gallery */}
      <section aria-label="صور الإعلان" className="mb-8">
        <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-surface-muted md:aspect-[21/9]">
          {images[activeImage] ? (
            <img src={images[activeImage].imageUrl} alt={`${listing.title} — صورة ${activeImage + 1}`} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-fg-subtle">
              <ImageOff className="h-10 w-10" aria-hidden />
            </div>
          )}
          <div className="absolute top-3 end-3 flex gap-2">
            <button type="button" onClick={share} aria-label="مشاركة الإعلان" className="inline-flex h-11 w-11 items-center justify-center rounded-pill bg-surface/90 text-fg shadow-sm">
              <Share2 className="h-5 w-5" aria-hidden />
            </button>
            {isAuthenticated && !isOwner && (
              <button
                type="button"
                onClick={() => toggleFavorite()}
                aria-pressed={isFavorite}
                aria-label={isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
                className="inline-flex h-11 w-11 items-center justify-center rounded-pill bg-surface/90 text-fg shadow-sm"
              >
                <Heart className={cn('h-5 w-5', isFavorite && 'fill-current text-danger')} aria-hidden />
              </button>
            )}
          </div>
        </div>
        {images.length > 1 && (
          <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <li key={img.id}>
                <button
                  type="button"
                  onClick={() => setActiveImage(i)}
                  aria-label={`عرض الصورة ${i + 1}`}
                  aria-current={i === activeImage}
                  className={cn('h-16 w-16 overflow-hidden rounded-control border-2', i === activeImage ? 'border-primary' : 'border-transparent')}
                >
                  <img src={img.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <article className="space-y-6 lg:col-span-2">
          <header>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-fg-subtle">
              {listing.category?.name && <Badge tone="primary">{listing.category.name}</Badge>}
              {listing.status === 'sold' && <Badge>تم البيع</Badge>}
              <span>نُشر {dateFormat.format(new Date(listing.createdAt))}</span>
              <span className="inline-flex items-center gap-1">
                <Eye className="h-4 w-4" aria-hidden /> {listing.viewsCount.toLocaleString('ar')} مشاهدة
              </span>
            </div>
            <h1 className="text-2xl font-bold text-fg md:text-3xl">{listing.title}</h1>
            <p className="mt-2 text-2xl font-bold text-primary md:text-3xl">{formatPrice(listing.price, listing.currency)}</p>
          </header>
          <section>
            <h2 className="mb-2 text-lg font-bold text-fg">الوصف</h2>
            <p className="whitespace-pre-line leading-relaxed text-fg-muted">{listing.description}</p>
          </section>
        </article>

        <aside className="lg:col-span-1">
          <Card className="space-y-4 p-6 lg:sticky lg:top-24">
            <Link href={`/users/${listing.userId}`} className="flex items-center gap-3 rounded-control hover:bg-surface-muted">
              {seller?.avatar ? (
                <img src={seller.avatar} alt="" className="h-14 w-14 rounded-pill object-cover" />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-pill bg-primary-soft text-xl font-bold text-on-primary-soft" aria-hidden>
                  {seller?.name?.charAt(0) ?? '؟'}
                </span>
              )}
              <span className="min-w-0">
                <span className="flex items-center gap-1 font-semibold text-fg">
                  {seller?.name ?? 'البائع'}
                  {seller?.isIdentityVerified && <BadgeCheck className="h-4 w-4 text-success" aria-label="هوية موثّقة" />}
                </span>
                {seller?.createdAt && <span className="block text-sm text-fg-muted">عضو منذ {new Date(seller.createdAt).getFullYear()}</span>}
              </span>
            </Link>

            {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

            {isOwner ? (
              <div className="space-y-2">
                <Button fullWidth onClick={() => router.push(`/listings/${listing.id}/edit`)}>
                  <Pencil className="h-4 w-4" aria-hidden /> تعديل الإعلان
                </Button>
                {listing.status === 'active' && (
                  <Button variant="secondary" fullWidth onClick={() => router.push(`/listings/${listing.id}/promote`)}>
                    <Rocket className="h-4 w-4" aria-hidden /> ترويج الإعلان
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {canBuy && (
                  <Button fullWidth loading={busy === 'buy'} onClick={buy}>
                    <ShoppingCart className="h-4 w-4" aria-hidden /> طلب شراء
                  </Button>
                )}
                <Button variant="secondary" fullWidth loading={busy === 'message'} onClick={message}>
                  <MessageCircle className="h-4 w-4" aria-hidden /> مراسلة البائع
                </Button>
                <p className="text-xs text-fg-muted">
                  الدفع عند اللقاء. لا تحوّل أي مبلغ قبل معاينة السلعة، وقابل البائع في مكان عام.
                </p>
              </div>
            )}

            {!isOwner && (
              <button
                type="button"
                onClick={() => (isAuthenticated ? setIsReportOpen(true) : requireLogin())}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-control text-sm font-medium text-danger hover:bg-danger-soft"
              >
                <Flag className="h-4 w-4" aria-hidden /> الإبلاغ عن الإعلان
              </button>
            )}
          </Card>
        </aside>
      </div>

      <RelatedListings currentListingId={listing.id} categoryId={listing.categoryId} />

      {isReportOpen && <ReportDialog targetType="listing" targetId={listing.id} onClose={() => setIsReportOpen(false)} />}
    </main>
  );
}
