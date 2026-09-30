'use client';

import Link from 'next/link';
import { Heart, ImageOff } from 'lucide-react';
import { Listing, conditionLabel, coverImage, formatPrice } from '@/types/listing';
import { useFavoriteCheck } from '@/hooks/useFavorite';
import { useAuthStore } from '@/lib/store/auth-store';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';

interface ListingCardProps {
  listing: Listing;
  onClick?: () => void;
}

const STATUS_BADGE: Partial<Record<Listing['status'], { label: string; tone: 'neutral' | 'warning' }>> = {
  sold: { label: 'تم البيع', tone: 'neutral' },
  expired: { label: 'منتهي', tone: 'warning' },
};

export function ListingCard({ listing, onClick }: ListingCardProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { isFavorite, toggleFavorite, isLoading } = useFavoriteCheck(listing.id);
  const image = coverImage(listing);
  const status = STATUS_BADGE[listing.status];

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] w-full bg-surface-muted">
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-fg-subtle">
            <ImageOff className="h-8 w-8" aria-hidden />
          </div>
        )}
        {status && <Badge tone={status.tone} className="absolute top-3 start-3">{status.label}</Badge>}
        {isAuthenticated && (
          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              if (!isLoading) await toggleFavorite();
            }}
            disabled={isLoading}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
            className="absolute top-2 end-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-pill bg-surface/80 text-fg-muted backdrop-blur-sm transition-colors hover:text-danger disabled:opacity-50"
          >
            <Heart className={cn('h-5 w-5', isFavorite && 'fill-current text-danger')} aria-hidden />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        {listing.category?.name && <p className="text-xs text-fg-subtle">{listing.category.name}</p>}
        <h3 className="line-clamp-2 font-semibold text-fg">
          {/* The whole card is clickable through this link's stretched overlay. */}
          <Link href={`/listings/${listing.id}`} onClick={onClick} className="after:absolute after:inset-0 hover:text-primary">
            {listing.title}
          </Link>
        </h3>
        <p className="mt-auto pt-2 text-lg font-bold text-primary">{formatPrice(listing.price, listing.currency)}</p>
        {(listing.condition || listing.location) && (
          <p className="truncate text-xs text-fg-muted">
            {[conditionLabel(listing.condition), listing.location].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </article>
  );
}
