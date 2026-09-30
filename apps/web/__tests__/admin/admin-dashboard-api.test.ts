import { adminDashboardApi } from '@/lib/api/admin-dashboard';
import { api } from '@/lib/api/auth';

jest.mock('../../src/lib/api/auth', () => ({ api: { get: jest.fn() } }));

const get = api.get as jest.Mock;

describe('adminDashboardApi', () => {
  beforeEach(() => get.mockReset());

  it('asks every owning service for the chosen window', async () => {
    get.mockResolvedValue({ data: {} });
    await adminDashboardApi.users(7);
    await adminDashboardApi.listings(90);
    await adminDashboardApi.transactions(30);
    expect(get.mock.calls).toEqual([
      ['/auth/admin/stats', { params: { days: 7 } }],
      ['/listings/admin/stats', { params: { days: 90 } }],
      ['/transactions/admin/stats', { params: { days: 30 } }],
    ]);
  });

  it('maps the moderation response, window included', async () => {
    get.mockResolvedValue({
      data: {
        window_days: 90,
        pending_reports: 4,
        total_reports: 40,
        reports_today: 1,
        resolved_today: 2,
        oldest_pending_hours: 30.5,
        avg_review_hours: 3.2,
        created_daily: [{ day: '2026-09-30', count: 1 }],
        handled_daily: [],
        reasons: [{ reason: 'scam', count: 3 }],
        top_reported_listings: [{ target_id: 'l1', pending_count: 2, total_count: 5 }],
        top_reported_users: [],
      },
    });
    const m = await adminDashboardApi.moderation(90);
    expect(get).toHaveBeenCalledWith('/admin/dashboard/stats', { params: { days: 90 } });
    expect(m).toEqual({
      windowDays: 90,
      pendingReports: 4,
      totalReports: 40,
      reportsToday: 1,
      handledToday: 2,
      oldestPendingHours: 30.5,
      avgReviewHours: 3.2,
      createdDaily: [{ day: '2026-09-30', count: 1 }],
      handledDaily: [],
      reasons: [{ reason: 'scam', count: 3 }],
      topReportedListings: [{ id: 'l1', pending: 2, total: 5 }],
      topReportedUsers: [],
    });
  });
});
