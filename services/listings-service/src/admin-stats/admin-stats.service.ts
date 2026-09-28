import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DailyPoint, TtlCache, dailySeries, sumLast, windowStart } from '../common/stats';

export interface ListingsAdminStats {
  generatedAt: string;
  listings: {
    active: number;
    sold: number;
    expired: number;
    createdLast7Days: number;
    createdPrevious7Days: number;
    createdDaily: DailyPoint[];
  };
  topCategories: Array<{ id: string; name: string; activeListings: number }>;
  promotions: { active: number; paidLast30Days: number; revenueLast30Days: number; currency: 'USD' };
}

/**
 * Aggregates for the admin dashboard. Every query is bounded (30-day window on an indexed
 * created_at, LIMIT on rankings) and the whole result is cached for a minute.
 */
@Injectable()
export class AdminStatsService {
  private readonly cache = new TtlCache<ListingsAdminStats>(60_000);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  getStats(): Promise<ListingsAdminStats> {
    return this.cache.get(() => this.compute());
  }

  private async compute(): Promise<ListingsAdminStats> {
    const since = windowStart();
    const [daily, statuses, categories, promos] = await Promise.all([
      this.db.query(
        `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS count
           FROM listings WHERE created_at >= $1 AND status <> 'deleted'
          GROUP BY 1`,
        [since],
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

    const createdDaily = dailySeries(daily);
    const byStatus = Object.fromEntries(statuses.map((r: { status: string; count: number }) => [r.status, r.count]));
    return {
      generatedAt: new Date().toISOString(),
      listings: {
        active: byStatus.active ?? 0,
        sold: byStatus.sold ?? 0,
        expired: byStatus.expired ?? 0,
        createdLast7Days: sumLast(createdDaily, 7),
        createdPrevious7Days: sumLast(createdDaily.slice(0, -7), 7),
        createdDaily,
      },
      topCategories: categories,
      promotions: {
        active: promos[0]?.active ?? 0,
        paidLast30Days: promos[0]?.paid ?? 0,
        revenueLast30Days: Math.round((promos[0]?.revenue ?? 0) * 100) / 100,
        currency: 'USD',
      },
    };
  }
}
