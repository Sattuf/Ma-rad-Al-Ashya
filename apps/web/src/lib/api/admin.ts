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
    const response = await api.patch(`/admin/reports/${id}/review`, data);
    return response.data;
  },

  getDashboardStats: async (): Promise<AdminStats> => {
    const response = await api.get('/admin/stats');
    return response.data;
  },
};
