import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DailyPoint, TtlCache, dailySeries, sumLast, windowStart } from '../common/stats';

export interface UsersAdminStats {
  generatedAt: string;
  totalUsers: number;
  identityVerified: number;
  suspendedOrBanned: number;
  signupsLast7Days: number;
  signupsPrevious7Days: number;
  signupsDaily: DailyPoint[];
}

@Injectable()
export class AdminStatsService {
  private readonly cache = new TtlCache<UsersAdminStats>(60_000);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  getStats(): Promise<UsersAdminStats> {
    return this.cache.get(() => this.compute());
  }

  private async compute(): Promise<UsersAdminStats> {
    const [daily, totals] = await Promise.all([
      this.db.query(
        `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS count
           FROM users WHERE created_at >= $1 GROUP BY 1`,
        [windowStart()],
      ),
      // One pass for all totals (cached for a minute, so the full scan is paid rarely).
      this.db.query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE is_identity_verified)::int AS verified,
                count(*) FILTER (WHERE status::text IN ('suspended', 'banned'))::int AS restricted
           FROM users`,
      ),
    ]);
    const signupsDaily = dailySeries(daily);
    return {
      generatedAt: new Date().toISOString(),
      totalUsers: totals[0]?.total ?? 0,
      identityVerified: totals[0]?.verified ?? 0,
      suspendedOrBanned: totals[0]?.restricted ?? 0,
      signupsLast7Days: sumLast(signupsDaily, 7),
      signupsPrevious7Days: sumLast(signupsDaily.slice(0, -7), 7),
      signupsDaily,
    };
  }
}
