import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DailyPoint, WindowedCache, dailySeries, seriesDays, sumLast, windowStart } from '../common/stats';

export interface UsersAdminStats {
  generatedAt: string;
  /** Days covered by the daily series (?days=7|30|90). */
  windowDays: number;
  totalUsers: number;
  identityVerified: number;
  suspendedOrBanned: number;
  signupsLast7Days: number;
  signupsPrevious7Days: number;
  signupsDaily: DailyPoint[];
}

@Injectable()
export class AdminStatsService {
  private readonly cache = new WindowedCache<UsersAdminStats>(60_000);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  getStats(days: number): Promise<UsersAdminStats> {
    return this.cache.get(days, () => this.compute(days));
  }

  private async compute(days: number): Promise<UsersAdminStats> {
    const span = seriesDays(days);
    const [daily, totals] = await Promise.all([
      this.db.query(
        `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS count
           FROM users WHERE created_at >= $1 GROUP BY 1`,
        [windowStart(span)],
      ),
      // One pass for all totals (cached for a minute, so the full scan is paid rarely).
      this.db.query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE is_identity_verified)::int AS verified,
                count(*) FILTER (WHERE status::text IN ('suspended', 'banned'))::int AS restricted
           FROM users`,
      ),
    ]);
    const series = dailySeries(daily, span);
    return {
      generatedAt: new Date().toISOString(),
      windowDays: days,
      totalUsers: totals[0]?.total ?? 0,
      identityVerified: totals[0]?.verified ?? 0,
      suspendedOrBanned: totals[0]?.restricted ?? 0,
      signupsLast7Days: sumLast(series, 7),
      signupsPrevious7Days: sumLast(series.slice(0, -7), 7),
      signupsDaily: series.slice(-days),
    };
  }
}
