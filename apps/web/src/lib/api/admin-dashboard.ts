import { api } from './auth';

/**
 * Admin dashboard sources. Each owning service aggregates its own data
 * (GET …/admin/stats, admin-only, cached ~60s server-side); the page combines them.
 * One service failing hides only its own section.
 */

export interface DailyPoint {
  day: string; // YYYY-MM-DD (UTC)
  count: number;
}

export interface UsersStats {
  totalUsers: number;
  identityVerified: number;
  suspendedOrBanned: number;
  signupsLast7Days: number;
  signupsPrevious7Days: number;
  signupsDaily: DailyPoint[];
}

export interface ListingsStats {
  listings: {
    active: number;
    sold: number;
    expired: number;
    createdLast7Days: number;
    createdPrevious7Days: number;
    createdDaily: DailyPoint[];
  };
  topCategories: Array<{ id: string; name: string; activeListings: number }>;
  promotions: { active: number; paidLast30Days: number; revenueLast30Days: number; currency: string };
}

export interface TransactionsStats {
  startedDaily: DailyPoint[];
  completedDaily: DailyPoint[];
  completedLast7Days: number;
  completedPrevious7Days: number;
  completionRate: number | null;
  openDeals: number;
  reviewsLast30Days: number;
  averageRatingLast30Days: number | null;
}

export interface ModerationStats {
  pendingReports: number;
  totalReports: number;
  reportsToday: number;
  handledToday: number;
  oldestPendingHours: number | null;
  avgReviewHours30d: number | null;
  createdDaily: DailyPoint[];
  handledDaily: DailyPoint[];
  reasons30d: Array<{ reason: string; count: number }>;
  topReportedListings: Array<{ id: string; pending: number; total: number }>;
  topReportedUsers: Array<{ id: string; pending: number; total: number }>;
}

export interface FraudStats {
  totalSignals: number;
  averageRisk: number;
  highRiskSignals7d: number;
  highRiskUsers7d: number;
}

interface ServerModerationStats {
  pending_reports: number;
  total_reports: number;
  reports_today: number;
  resolved_today: number;
  oldest_pending_hours: number | null;
  avg_review_hours_30d: number | null;
  created_daily: DailyPoint[];
  handled_daily: DailyPoint[];
  reasons_30d: Array<{ reason: string; count: number }>;
  top_reported_listings: Array<{ target_id: string; pending_count: number; total_count: number }>;
  top_reported_users: Array<{ target_id: string; pending_count: number; total_count: number }>;
}

const toTop = (rows: ServerModerationStats['top_reported_listings'] = []) =>
  rows.map((r) => ({ id: r.target_id, pending: r.pending_count, total: r.total_count }));

export const adminDashboardApi = {
  users: async (): Promise<UsersStats> => (await api.get('/auth/admin/stats')).data,
  listings: async (): Promise<ListingsStats> => (await api.get('/listings/admin/stats')).data,
  transactions: async (): Promise<TransactionsStats> => (await api.get('/transactions/admin/stats')).data,
  moderation: async (): Promise<ModerationStats> => {
    const s: ServerModerationStats = (await api.get('/admin/dashboard/stats')).data;
    return {
      pendingReports: s.pending_reports,
      totalReports: s.total_reports,
      reportsToday: s.reports_today,
      handledToday: s.resolved_today,
      oldestPendingHours: s.oldest_pending_hours,
      avgReviewHours30d: s.avg_review_hours_30d,
      createdDaily: s.created_daily ?? [],
      handledDaily: s.handled_daily ?? [],
      reasons30d: s.reasons_30d ?? [],
      topReportedListings: toTop(s.top_reported_listings),
      topReportedUsers: toTop(s.top_reported_users),
    };
  },
  fraud: async (): Promise<FraudStats> => {
    const s = (await api.get('/fraud/admin/dashboard')).data;
    return {
      totalSignals: s.total_signals ?? 0,
      averageRisk: s.average_risk ?? 0,
      highRiskSignals7d: s.high_risk_signals_7d ?? 0,
      highRiskUsers7d: s.high_risk_users_7d ?? 0,
    };
  },
};
