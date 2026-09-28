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

const numberFormatters = new Map<number, Intl.NumberFormat>();

// Arabic currency names: "US$" inside right-to-left text is reordered by the bidi
// algorithm and shows up as "$US 334", so the unit is written as a word instead.
const CURRENCY_NAMES: Record<string, string> = { USD: 'دولار', SAR: 'ر.س', AED: 'د.إ', EUR: 'يورو', SYP: 'ل.س', IQD: 'د.ع', EGP: 'ج.م' };

/** "1,250.5" + "USD" → "1,250.5 دولار". Unknown currencies keep their ISO code. */
export function formatMoney(value: number | string, currency = 'USD', maxFractionDigits = 2): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  let fmt = numberFormatters.get(maxFractionDigits);
  if (!fmt) {
    fmt = new Intl.NumberFormat('ar', { maximumFractionDigits: maxFractionDigits });
    numberFormatters.set(maxFractionDigits, fmt);
  }
  return `${fmt.format(n)} ${CURRENCY_NAMES[currency] ?? currency}`;
}

/** Listing price for Arabic readers, in the listing's currency. */
export function formatPrice(price: number | string, currency = 'USD'): string {
  return formatMoney(price, currency, 2);
}
