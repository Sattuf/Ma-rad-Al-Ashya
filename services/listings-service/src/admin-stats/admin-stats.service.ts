import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DailyPoint, WindowedCache, dailySeries, seriesDays, sumLast, windowStart } from '../common/stats';

export interface ListingsAdminStats {
  generatedAt: string;
  /** Days covered by the daily series and the promotion totals (?days=7|30|90). */
  windowDays: number;
  listings: {
    active: number;
    sold: number;
    expired: number;
    createdLast7Days: number;
    createdPrevious7Days: number;
    createdDaily: DailyPoint[];
  };
  topCategories: Array<{ id: string; name: string; activeListings: number }>;
  promotions: { active: number; paidInWindow: number; revenueInWindow: number; currency: 'USD' };
}

/**
 * Aggregates for the admin dashboard. Every query is bounded (7/30/90-day window on an indexed
 * created_at, LIMIT on rankings) and the whole result is cached for a minute.
 */
@Injectable()
export class AdminStatsService {
  private readonly cache = new WindowedCache<ListingsAdminStats>(60_000);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  getStats(days: number): Promise<ListingsAdminStats> {
    return this.cache.get(days, () => this.compute(days));
  }

  private async compute(days: number): Promise<ListingsAdminStats> {
    const span = seriesDays(days);
    const since = windowStart(days);
    const [daily, statuses, categories, promos] = await Promise.all([
      this.db.query(
        `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS count
           FROM listings WHERE created_at >= $1 AND status <> 'deleted'
          GROUP BY 1`,
        [windowStart(span)],
      ),
      // Served by idx_listings_status_created (index-only per status).
      this.db.query(`SELECT status, count(*)::int AS count FROM listings WHERE status <> 'deleted' GROUP BY status`),
      this.db.query(
        `SELECT c.id, c.name, count(*)::int AS "activeListings"
           FROM listings l JOIN categories c ON c.id = l.category_id
          WHERE l.status = 'active'
          GROUP BY c.id, c.name
          ORDER BY 3 DESC, c.name
          LIMIT 8`,
      ),
      this.db.query(
        `SELECT
           count(*) FILTER (WHERE expires_at > now())::int AS active,
           count(*) FILTER (WHERE created_at >= $1)::int AS paid,
           coalesce(sum(price_paid) FILTER (WHERE created_at >= $1), 0)::float AS revenue
         FROM promotions WHERE stripe_payment_status = 'succeeded'`,
        [since],
      ),
    ]);

    const series = dailySeries(daily, span);
    const byStatus = Object.fromEntries(statuses.map((r: { status: string; count: number }) => [r.status, r.count]));
    return {
      generatedAt: new Date().toISOString(),
      windowDays: days,
      listings: {
        active: byStatus.active ?? 0,
        sold: byStatus.sold ?? 0,
        expired: byStatus.expired ?? 0,
        createdLast7Days: sumLast(series, 7),
        createdPrevious7Days: sumLast(series.slice(0, -7), 7),
        createdDaily: series.slice(-days),
      },
      topCategories: categories,
      promotions: {
        active: promos[0]?.active ?? 0,
        paidInWindow: promos[0]?.paid ?? 0,
        revenueInWindow: Math.round((promos[0]?.revenue ?? 0) * 100) / 100,
        currency: 'USD',
      },
    };
  }
}
