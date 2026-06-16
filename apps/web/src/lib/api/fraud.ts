import { api } from './auth';

export const fraudApi = {
  getDashboardStats: async () => {
    const response = await api.get('/fraud/admin/dashboard');
    return response.data;
  },
  getSignals: async () => {
    const response = await api.get('/fraud/admin/signals');
    return response.data;
  },
  getRiskDetails: async (userId: string) => {
    const response = await api.get(`/fraud/risk/${userId}`);
    return response.data;
  },
  takeAction: async (userId: string, actionType: string, reason: string) => {
    const response = await api.post('/fraud/admin/action', {
      user_id: userId,
      action_type: actionType,
      reason,
    });
    return response.data;
  },
};
