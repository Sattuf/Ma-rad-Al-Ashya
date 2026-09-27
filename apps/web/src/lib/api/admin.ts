import { api } from './auth';

export interface Report {
  id: string;
  targetType: 'listing' | 'user';
  targetId: string;
  reporterId: string;
  reason: string;
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  actionTaken?: 'none' | 'warning' | 'listing_removed' | 'user_suspended' | 'user_banned';
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
  targetInfo?: any; // populated info about the listing or user
}

export interface AdminStats {
  pendingReports: number;
  reportsToday: number;
  resolvedToday: number;
  totalReports: number;
  topReportedListings: Array<{ id: string; title: string; count: number }>;
  topReportedUsers: Array<{ id: string; name: string; count: number }>;
}

export const adminApi = {
  getReports: async (
    status?: string,
    targetType?: string,
    page: number = 1,
    limit: number = 10
  ) => {
    const params = { status, targetType, page, limit };
    const response = await api.get('/admin/reports', { params });
    return response.data;
  },

  getReport: async (id: string): Promise<Report> => {
    const response = await api.get(`/admin/reports/${id}`);
    return response.data;
  },

  reviewReport: async (
    id: string,
    data: {
      status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
      actionTaken: 'none' | 'warning' | 'listing_removed' | 'user_suspended' | 'user_banned';
      adminNote?: string;
    }
  ): Promise<Report> => {
    // moderation-service reads snake_case; camelCase fields were silently ignored,
    // so no moderation action (removal, suspension) was ever applied.
    const response = await api.put(`/admin/reports/${id}/review`, {
      status: data.status,
      action_taken: data.actionTaken,
      admin_note: data.adminNote,
    });
    return response.data;
  },

  getDashboardStats: async (): Promise<AdminStats> => {
    const response = await api.get('/admin/dashboard/stats');
    const s = response.data as {
      pending_reports: number;
      reports_today: number;
      resolved_today: number;
      total_reports?: number;
      top_reported_listings: Array<{ target_id: string; pending_count: number; total_count: number }>;
      top_reported_users: Array<{ target_id: string; pending_count: number; total_count: number }>;
    };
    return {
      pendingReports: s.pending_reports,
      reportsToday: s.reports_today,
      resolvedToday: s.resolved_today,
      totalReports: s.total_reports ?? 0,
      topReportedListings: s.top_reported_listings.map((r) => ({ id: r.target_id, title: r.target_id, count: r.pending_count })),
      topReportedUsers: s.top_reported_users.map((r) => ({ id: r.target_id, name: r.target_id, count: r.pending_count })),
    };
  },
};
