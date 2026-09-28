/**
 * Post-login redirect target from `?next=`. Only same-origin paths are allowed:
 * "/listings/1" yes; "//evil.com", "/\evil.com", "/%09/evil.com" (tab/newline, which URL
 * parsers strip), "https://evil.com" → "/" (open-redirect guard).
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || raw.length > 2048 || !raw.startsWith('/')) return '/';
  // Control characters, whitespace and backslashes are never needed in our paths and are
  // exactly what browsers normalise into "//host".
  if (/[\u0000-\u001F\u007F\s\\]/.test(raw) || raw.startsWith('//')) return '/';
  try {
    // Final check with the same parser the browser/redirect uses.
    const base = 'https://same-origin.invalid';
    const url = new URL(raw, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : '/';
  } catch {
    return '/';
  }
}
