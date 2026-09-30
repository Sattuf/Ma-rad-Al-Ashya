import { api } from './auth';

/**
 * Admin dashboard sources. Each owning service aggregates its own data
 * (GET …/admin/stats, admin-only, cached ~60s server-side); the page combines them.
 * One service failing hides only its own section.
 * `days` selects the window (7, 30 or 90); the servers ignore anything else.
 */

export const DASHBOARD_WINDOWS = [7, 30, 90] as const;
export type DashboardWindow = (typeof DASHBOARD_WINDOWS)[number];

export interface DailyPoint {
  day: string; // YYYY-MM-DD (UTC)
  count: number;
}

export interface UsersStats {
  windowDays: number;
  totalUsers: number;
  identityVerified: number;
  suspendedOrBanned: number;
  signupsLast7Days: number;
  signupsPrevious7Days: number;
  signupsDaily: DailyPoint[];
}

export interface ListingsStats {
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
  promotions: { active: number; paidInWindow: number; revenueInWindow: number; currency: string };
}

export interface TransactionsStats {
  windowDays: number;
  startedDaily: DailyPoint[];
  completedDaily: DailyPoint[];
  completedLast7Days: number;
  completedPrevious7Days: number;
  completionRate: number | null;
  openDeals: number;
  reviewsInWindow: number;
  averageRatingInWindow: number | null;
}

export interface ModerationStats {
  windowDays: number;
  pendingReports: number;
  totalReports: number;
  reportsToday: number;
  handledToday: number;
  oldestPendingHours: number | null;
  avgReviewHours: number | null;
  createdDaily: DailyPoint[];
  handledDaily: DailyPoint[];
  reasons: Array<{ reason: string; count: number }>;
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
  window_days: number;
  pending_reports: number;
  total_reports: number;
  reports_today: number;
  resolved_today: number;
  oldest_pending_hours: number | null;
  avg_review_hours: number | null;
  created_daily: DailyPoint[];
  handled_daily: DailyPoint[];
  reasons: Array<{ reason: string; count: number }>;
  top_reported_listings: Array<{ target_id: string; pending_count: number; total_count: number }>;
  top_reported_users: Array<{ target_id: string; pending_count: number; total_count: number }>;
}

const toTop = (rows: ServerModerationStats['top_reported_listings'] = []) =>
  rows.map((r) => ({ id: r.target_id, pending: r.pending_count, total: r.total_count }));

export const adminDashboardApi = {
  users: async (days: DashboardWindow): Promise<UsersStats> => (await api.get('/auth/admin/stats', { params: { days } })).data,
  listings: async (days: DashboardWindow): Promise<ListingsStats> => (await api.get('/listings/admin/stats', { params: { days } })).data,
  transactions: async (days: DashboardWindow): Promise<TransactionsStats> =>
    (await api.get('/transactions/admin/stats', { params: { days } })).data,
  moderation: async (days: DashboardWindow): Promise<ModerationStats> => {
    const s: ServerModerationStats = (await api.get('/admin/dashboard/stats', { params: { days } })).data;
    return {
      windowDays: s.window_days ?? days,
      pendingReports: s.pending_reports,
      totalReports: s.total_reports,
      reportsToday: s.reports_today,
      handledToday: s.resolved_today,
      oldestPendingHours: s.oldest_pending_hours,
      avgReviewHours: s.avg_review_hours,
      createdDaily: s.created_daily ?? [],
      handledDaily: s.handled_daily ?? [],
      reasons: s.reasons ?? [],
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
