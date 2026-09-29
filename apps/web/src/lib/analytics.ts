import { API_URL } from './api/auth';
export interface TrackingData {
  listingId?: string;
  categoryId?: string;
  searchQuery?: string;
}

/**
 * Fire-and-forget behaviour event for recommendations. The gateway routes `/events` to the
 * personalization service, which takes the user from the token and the fields flat
 * (same shape as the mobile app sends). Anonymous visitors are not tracked.
 */
export function trackEvent(eventType: string, data?: TrackingData) {
  if (typeof window === 'undefined') return;
  const token = localStorage.getItem('access_token');
  if (!token) return;

  // keepalive lets a click event finish even when it navigates away from the page.
  fetch(`${API_URL}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ eventType, ...data }),
    keepalive: true,
  }).catch(() => {
    // Analytics must never break the page.
  });
}
