import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DailyPoint, TtlCache, dailySeries, sumLast, windowStart } from '../common/stats';

export interface TransactionsAdminStats {
  generatedAt: string;
  startedDaily: DailyPoint[];
  completedDaily: DailyPoint[];
  completedLast7Days: number;
  completedPrevious7Days: number;
  /** Of the deals started in the window that have finished: share completed, 0–1 (null if none finished). */
  completionRate: number | null;
  openDeals: number;
  reviewsLast30Days: number;
  averageRatingLast30Days: number | null;
}

@Injectable()
export class AdminStatsService {
  private readonly cache = new TtlCache<TransactionsAdminStats>(60_000);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  getStats(): Promise<TransactionsAdminStats> {
    return this.cache.get(() => this.compute());
  }

  private async compute(): Promise<TransactionsAdminStats> {
    // transactions.created_at is TIMESTAMP (no zone) written by the DB in UTC.
    const since = windowStart().toISOString().slice(0, 19).replace('T', ' ');
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
        [since],
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

    const completedDaily = dailySeries(completed);
    const finished = (outcome[0]?.completed ?? 0) + (outcome[0]?.cancelled ?? 0);
    return {
      generatedAt: new Date().toISOString(),
      startedDaily: dailySeries(started),
      completedDaily,
      completedLast7Days: sumLast(completedDaily, 7),
      completedPrevious7Days: sumLast(completedDaily.slice(0, -7), 7),
      completionRate: finished ? Math.round((outcome[0].completed / finished) * 1000) / 1000 : null,
      openDeals: open[0]?.count ?? 0,
      reviewsLast30Days: reviews[0]?.count ?? 0,
      averageRatingLast30Days: reviews[0]?.avg == null ? null : Math.round(reviews[0].avg * 10) / 10,
    };
  }
}
