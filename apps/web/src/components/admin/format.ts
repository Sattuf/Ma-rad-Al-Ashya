import { formatMoney } from '@/types/listing';

/** Number and date formatting for the admin dashboard (Arabic locale, cached formatters). */

const integer = new Intl.NumberFormat('ar');
const compact = new Intl.NumberFormat('ar', { notation: 'compact', maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat('ar', { style: 'percent', maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat('ar', { maximumFractionDigits: 1 });
const dayMonth = new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fullDay = new Intl.DateTimeFormat('ar', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export const fmt = {
  int: (n: number) => integer.format(n),
  /** 1284 → "1,284"; 12900 → "12.9 ألف". Exact below 10k so small numbers stay precise. */
  compact: (n: number) => (Math.abs(n) < 10_000 ? integer.format(n) : compact.format(n)),
  percent: (ratio: number) => percent.format(ratio),
  decimal: (n: number) => oneDecimal.format(n),
  money: (n: number, currency = 'USD') => formatMoney(n, currency, 0),
  /** "2026-03-10" → "10 مارس" */
  day: (iso: string) => dayMonth.format(new Date(`${iso}T00:00:00Z`)),
  fullDay: (iso: string) => fullDay.format(new Date(`${iso}T00:00:00Z`)),
  hours: (h: number) => (h < 1 ? `${integer.format(Math.max(1, Math.round(h * 60)))} دقيقة` : h < 48 ? `${oneDecimal.format(h)} ساعة` : `${oneDecimal.format(h / 24)} يوم`),
};

/**
 * Change vs the previous period. `null` when there is no baseline (0 → n is "new",
 * not "+∞%"), so the tile can say so instead of printing a misleading percentage.
 */
export function delta(current: number, previous: number): { ratio: number | null; direction: 'up' | 'down' | 'flat' } {
  if (current === previous) return { ratio: 0, direction: 'flat' };
  if (previous === 0) return { ratio: null, direction: 'up' };
  const ratio = (current - previous) / previous;
  return { ratio, direction: ratio > 0 ? 'up' : 'down' };
}
