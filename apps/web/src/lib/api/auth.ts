import axios from 'axios';
import Cookies from 'js-cookie';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** On an unrecoverable 401, reject instead of redirecting to /login. */
    skipLoginRedirect?: boolean;
  }
}

/** Public gateway URL, inlined at build time. Localhost only as a dev default. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = Cookies.get('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const newAccessToken = data.tokens.access_token;
        const newRefreshToken = data.tokens.refresh_token;

        localStorage.setItem('access_token', newAccessToken);
        Cookies.set('refresh_token', newRefreshToken, { expires: 7, secure: true, sameSite: 'strict' });

        api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          Cookies.remove('refresh_token');
          // Background checks (session restore) must not push a guest off a public page.
          if (!originalRequest.skipLoginRedirect) {
            window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
          }
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  register: async (data: any) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },
  
  login: async (data: any) => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },
  
  sendOtp: async (phone: string) => {
    const response = await api.post('/auth/send-otp', { phone });
    return response.data;
  },
  
  verifyOtp: async (data: { phone: string; code: string }) => {
    const response = await api.post('/auth/verify-otp', data);
    return response.data;
  },
  
  logout: async () => {
    const refreshToken = Cookies.get('refresh_token');
    if (refreshToken) {
      await api.post('/auth/logout', { refresh_token: refreshToken }).catch(() => {});
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      Cookies.remove('refresh_token');
    }
  },
};
