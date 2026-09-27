/**
 * Listing as returned by listings-service (entity Listing + relations).
 * The previous type described a real-estate model (bedrooms, area, location…) the
 * server never returned, so cards crashed on `listing.location.city` with real data.
 */
export interface ListingImage {
  id: string;
  imageUrl: string;
  thumbnailUrl: string;
  sortOrder: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  children?: Category[];
}

export type ListingStatus = 'active' | 'sold' | 'expired' | 'deleted';

export interface Listing {
  id: string;
  userId: string;
  title: string;
  description: string;
  /** Postgres DECIMAL comes back as a string. */
  price: number | string;
  currency: string;
  status: ListingStatus;
  viewsCount: number;
  categoryId?: string | null;
  category?: Category | null;
  images: ListingImage[];
  createdAt: string;
  updatedAt: string;
}

export interface ListingsQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  userId?: string;
  /** Comma-separated listing ids (max 20); batch lookup that does not count views. */
  ids?: string;
}

export interface CreateListingInput {
  title: string;
  description: string;
  price: number;
  currency?: string;
  categoryId?: string;
}

export function coverImage(listing: Pick<Listing, 'images'>, size: 'thumb' | 'full' = 'thumb'): string | null {
  const first = [...(listing.images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)[0];
  if (!first) return null;
  return size === 'thumb' ? first.thumbnailUrl : first.imageUrl;
}

const priceFormatters = new Map<string, Intl.NumberFormat>();

/** Formats a price for Arabic readers, e.g. "١٬٢٥٠ US$" → uses the listing currency. */
export function formatPrice(price: number | string, currency = 'USD'): string {
  const value = typeof price === 'string' ? Number(price) : price;
  if (!Number.isFinite(value)) return '—';
  let fmt = priceFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat('ar', { style: 'currency', currency, maximumFractionDigits: 2 });
    priceFormatters.set(currency, fmt);
  }
  return fmt.format(value);
}
