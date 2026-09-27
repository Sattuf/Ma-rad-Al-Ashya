import { API_URL } from './api/auth';
export interface TrackingData {
  listingId?: string;
  categoryId?: string;
  searchQuery?: string;
}

export function trackEvent(
  eventType: string,
  data?: TrackingData
) {
  const url = `${API_URL}/recommendations/events`;
  const timestamp = new Date().toISOString();
  
  let userId: string | null = null;
  let token: string | null = null;

  if (typeof window !== 'undefined') {
    token = localStorage.getItem('access_token');
    // Try to extract userId from token or store if needed
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const parsed = JSON.parse(userStr);
        userId = parsed.id || null;
      }
    } catch (e) {
      // ignore
    }
  }

  const payload = {
    eventType,
    userId,
    data,
    timestamp,
  };

  const bodyString = JSON.stringify(payload);

  // Print tracking event in console for debugging / visibility
  console.log(`[Analytics Event Tracked]: ${eventType}`, payload);

  if (typeof window !== 'undefined') {
    // If browser supports sendBeacon and we don't need auth headers (or send it as simple text/plain Blob)
    // we can use sendBeacon. Otherwise fetch with keepalive: true is ideal.
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      fetch(url, {
        method: 'POST',
        headers,
        body: bodyString,
        keepalive: true,
      }).catch((err) => {
        // Silent catch for network disconnects/etc.
      });
    } catch (err) {
      // Fallback to sendBeacon if fetch with keepalive throws
      if (navigator.sendBeacon) {
        const blob = new Blob([bodyString], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      }
    }
  }
}
