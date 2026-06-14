import { api } from './auth';

export const userApi = {
  getProfile: async () => {
    const response = await api.get('/users/profile');
    return response.data;
  },

  updateProfile: async (data: any) => {
    const response = await api.patch('/users/profile', data);
    return response.data;
  },

  uploadAvatar: async (formData: FormData) => {
    const response = await api.post('/users/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  updateNotifications: async (data: any) => {
    const response = await api.patch('/users/notifications', data);
    return response.data;
  },
};
