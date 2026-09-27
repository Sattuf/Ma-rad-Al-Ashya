/**
 * Helpers for the admin dashboard endpoints (`GET …/admin/stats`).
 *
 * Shared copy: identical in every service that has it (scripts/check-shared-copies.mjs).
 * Dashboards are read far more often than their numbers change, so each result is
 * cached in memory for a short time: a room of admins refreshing the page costs the
 * database one set of aggregate queries per TTL, per instance.
 */

/** Days covered by daily series. Aggregate queries must filter on this window. */
export const STATS_WINDOW_DAYS = 30;

export interface DailyPoint {
  /** UTC calendar day, YYYY-MM-DD. */
  day: string;
  count: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Start (UTC midnight) of the first day in the window. */
export function windowStart(days = STATS_WINDOW_DAYS, now = new Date()): Date {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(today - (days - 1) * DAY_MS);
}

/**
 * Turns sparse SQL rows (`GROUP BY day`, days without rows are missing) into a dense,
 * ordered series with explicit zeros, so charts never skip or interpolate over a day.
 */
export function dailySeries(
  rows: Array<{ day: string | Date; count: number | string }>,
  days = STATS_WINDOW_DAYS,
  now = new Date(),
): DailyPoint[] {
  const byDay = new Map(rows.map((r) => [typeof r.day === 'string' ? r.day.slice(0, 10) : isoDay(r.day), Number(r.count)]));
  const start = windowStart(days, now).getTime();
  return Array.from({ length: days }, (_, i) => {
    const day = isoDay(new Date(start + i * DAY_MS));
    return { day, count: byDay.get(day) ?? 0 };
  });
}

/** Sum of the last `n` points of a series (e.g. "last 7 days"). */
export function sumLast(series: DailyPoint[], n: number): number {
  return series.slice(-n).reduce((total, p) => total + p.count, 0);
}

/** Memoizes one async computation for `ttlMs`; concurrent callers share the in-flight promise. */
export class TtlCache<T> {
  private value?: { at: number; promise: Promise<T> };

  constructor(private readonly ttlMs = 60_000) {}

  get(compute: () => Promise<T>, now = Date.now()): Promise<T> {
    if (this.value && now - this.value.at < this.ttlMs) return this.value.promise;
    const promise = compute().catch((err) => {
      this.value = undefined; // never cache a failure
      throw err;
    });
    this.value = { at: now, promise };
    return promise;
  }
}
