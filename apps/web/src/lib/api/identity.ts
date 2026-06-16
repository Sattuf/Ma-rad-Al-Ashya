import { api } from './auth';

export const identityApi = {
  startKyc: async () => {
    const response = await api.post('/identity/kyc/start');
    return response.data;
  },

  getKycStatus: async () => {
    const response = await api.get('/identity/kyc/status');
    return response.data;
  },
};
