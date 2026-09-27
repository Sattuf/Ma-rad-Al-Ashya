'use client';

import { useEffect } from 'react';
import Cookies from 'js-cookie';
import { api } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth-store';

/**
 * Restores the signed-in user after a page load. Tokens survive a reload (localStorage +
 * refresh cookie) but the in-memory store does not; without this, every refresh showed a
 * signed-in user as a guest. The API interceptor refreshes an expired access token.
 */
export function SessionRestore() {
  const { setAuth, clearAuth, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) return;
    const token = localStorage.getItem('access_token');
    if (!token && !Cookies.get('refresh_token')) {
      clearAuth();
      return;
    }
    let cancelled = false;
    api
      .get('/auth/me', { skipLoginRedirect: true })
      .then(({ data }) => {
        if (!cancelled) setAuth(data.user, localStorage.getItem('access_token') ?? '');
      })
      .catch(() => {
        if (!cancelled) clearAuth();
      });
    return () => {
      cancelled = true;
    };
    // Runs once per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
