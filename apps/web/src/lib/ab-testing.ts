export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  const key = 'marad_session_id';
  let sessionId = localStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(key, sessionId);
  }
  return sessionId;
}
