/**
 * Post-login redirect target from `?next=`. Only same-origin paths are allowed:
 * "/listings/1" yes; "//evil.com", "/\evil.com", "https://evil.com" → "/" (open-redirect guard).
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}
