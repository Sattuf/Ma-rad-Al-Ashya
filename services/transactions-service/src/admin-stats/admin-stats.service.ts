import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DailyPoint, WindowedCache, dailySeries, seriesDays, sumLast, windowStart } from '../common/stats';

export interface TransactionsAdminStats {
  generatedAt: string;
  /** Days covered by the series, completion rate and reviews (?days=7|30|90). */
  windowDays: number;
  startedDaily: DailyPoint[];
  completedDaily: DailyPoint[];
  completedLast7Days: number;
  completedPrevious7Days: number;
  /** Of the deals started in the window that have finished: share completed, 0–1 (null if none finished). */
  completionRate: number | null;
  openDeals: number;
  reviewsInWindow: number;
  averageRatingInWindow: number | null;
}

@Injectable()
export class AdminStatsService {
  private readonly cache = new WindowedCache<TransactionsAdminStats>(60_000);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  getStats(days: number): Promise<TransactionsAdminStats> {
    return this.cache.get(days, () => this.compute(days));
  }

  private async compute(days: number): Promise<TransactionsAdminStats> {
    // transactions.created_at is TIMESTAMP (no zone) written by the DB in UTC.
    const utc = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
    const span = seriesDays(days);
    const since = utc(windowStart(days));
    const [started, completed, outcome, open, reviews] = await Promise.all([
      this.db.query(
        `SELECT to_char(created_at, 'YYYY-MM-DD') AS day, count(*)::int AS count
           FROM transactions WHERE created_at >= $1 GROUP BY 1`,
        [since],
      ),
      // A deal completes when the second party confirms.
      this.db.query(
        `SELECT to_char(GREATEST(seller_confirmed_at, buyer_confirmed_at), 'YYYY-MM-DD') AS day, count(*)::int AS count
           FROM transactions
          WHERE status = 'completed' AND GREATEST(seller_confirmed_at, buyer_confirmed_at) >= $1
          GROUP BY 1`,
        [utc(windowStart(span))],
      ),
      this.db.query(
        `SELECT count(*) FILTER (WHERE status = 'completed')::int AS completed,
                count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
           FROM transactions WHERE created_at >= $1`,
        [since],
      ),
      this.db.query(`SELECT count(*)::int AS count FROM transactions WHERE status IN ('pending_seller', 'pending_buyer')`),
      this.db.query(
        `SELECT count(*)::int AS count, avg(rating)::float AS avg FROM reviews WHERE created_at >= $1`,
        [since],
      ),
    ]);

    const completedSeries = dailySeries(completed, span);
    const finished = (outcome[0]?.completed ?? 0) + (outcome[0]?.cancelled ?? 0);
    return {
      generatedAt: new Date().toISOString(),
      windowDays: days,
      startedDaily: dailySeries(started, days),
      completedDaily: completedSeries.slice(-days),
      completedLast7Days: sumLast(completedSeries, 7),
      completedPrevious7Days: sumLast(completedSeries.slice(0, -7), 7),
      completionRate: finished ? Math.round((outcome[0].completed / finished) * 1000) / 1000 : null,
      openDeals: open[0]?.count ?? 0,
      reviewsInWindow: reviews[0]?.count ?? 0,
      averageRatingInWindow: reviews[0]?.avg == null ? null : Math.round(reviews[0].avg * 10) / 10,
    };
  }
}
