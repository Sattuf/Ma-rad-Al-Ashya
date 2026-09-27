import { create } from 'zustand';

interface User {
  id: string;
  email?: string;
  phone?: string;
  fullName: string;
  role: string;
  status: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  /** True once the stored session has been checked on page load (signed in or not). */
  hydrated: boolean;
  setHydrated: () => void;
  setAuth: (user: User, accessToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  hydrated: false,
  setHydrated: () => set({ hydrated: true }),
  setAuth: (user, accessToken) => set({ user, accessToken, isAuthenticated: true, hydrated: true }),
  clearAuth: () => set({ user: null, accessToken: null, isAuthenticated: false, hydrated: true }),
}));
