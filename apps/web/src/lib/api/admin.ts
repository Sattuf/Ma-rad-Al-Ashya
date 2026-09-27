import { api } from './auth';
import { listingsApi } from './listings';
import { userApi } from './users';

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
  /** Readable target, resolved on the client (listing title or user name). */
  targetInfo?: { title?: string; name?: string };
  /** Other reports on the same target (detail view only). */
  related?: Report[];
}

interface ServerReport {
  id: string;
  target_type: 'listing' | 'user';
  target_id: string;
  reporter_id: string;
  reason: string;
  description: string | null;
  status: Report['status'];
  action_taken: Report['actionTaken'] | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

// moderation-service returns snake_case rows; the UI works with camelCase.
const toReport = (r: ServerReport): Report => ({
  id: r.id,
  targetType: r.target_type,
  targetId: r.target_id,
  reporterId: r.reporter_id,
  reason: r.reason,
  description: r.description ?? undefined,
  status: r.status,
  actionTaken: r.action_taken ?? undefined,
  adminNote: r.admin_note ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** Adds the listing title / user name to each report (two batch lookups; failures leave ids). */
async function withTargets(reports: Report[]): Promise<Report[]> {
  const listingIds = [...new Set(reports.filter((r) => r.targetType === 'listing').map((r) => r.targetId))];
  const userIds = [...new Set(reports.filter((r) => r.targetType === 'user').map((r) => r.targetId))];
  const [listings, users] = await Promise.all([
    listingIds.length
      ? listingsApi.getListings({ ids: listingIds.join(','), limit: listingIds.length }).then((p) => new Map(p.data.map((l) => [l.id, l.title]))).catch(() => new Map<string, string>())
      : new Map<string, string>(),
    Promise.allSettled(userIds.map((id) => userApi.getUser(id))).then(
      (found) => new Map(found.flatMap((r, i) => (r.status === 'fulfilled' ? [[userIds[i], r.value.name] as const] : []))),
    ),
  ]);
  return reports.map((r) => ({
    ...r,
    targetInfo: r.targetType === 'listing' ? { title: listings.get(r.targetId) } : { name: users.get(r.targetId) },
  }));
}

export const adminApi = {
  getReports: async (
    status?: string,
    targetType?: string,
    page: number = 1,
    limit: number = 10
  ) => {
    const params = { status, target_type: targetType, page, limit };
    const response = await api.get('/admin/reports', { params });
    const { data, total } = response.data as { data: ServerReport[]; total: number };
    return { data: await withTargets((data ?? []).map(toReport)), total, lastPage: Math.max(1, Math.ceil(total / limit)) };
  },

  getReport: async (id: string): Promise<Report> => {
    const response = await api.get(`/admin/reports/${id}`);
    const { report, relatedReports } = response.data as { report: ServerReport; relatedReports: ServerReport[] };
    const [withTarget] = await withTargets([toReport(report)]);
    return { ...withTarget, related: (relatedReports ?? []).filter((r) => r.id !== report.id).map(toReport) };
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
    return toReport(response.data);
  },
};
