import { api } from './auth';

export interface CreateReportDto {
  targetType: 'listing' | 'user';
  targetId: string;
  reason: string;
  description?: string;
}

export const reportsApi = {
  createReport: async (data: CreateReportDto): Promise<void> => {
    await api.post('/reports', data);
  },
};
