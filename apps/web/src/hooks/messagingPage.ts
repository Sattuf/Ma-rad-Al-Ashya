import { api } from '@/lib/api/auth';

export const MESSAGING_PAGE_SIZE = 20;

export interface MessagingPage<T> {
  data: T[];
  /** Opaque keyset cursor for the next (older) page; null at the end. */
  nextCursor: string | null;
  hasMore: boolean;
}

/** messaging-service answers `{ data, nextCursor }` (keyset pages, never OFFSET). */
export async function fetchMessagingPage<T>(url: string): Promise<MessagingPage<T>> {
  const res = await api.get(url);
  const nextCursor: string | null = res.data?.nextCursor ?? null;
  return { data: (res.data?.data ?? []) as T[], nextCursor, hasMore: nextCursor !== null };
}

/** SWR-infinite key: the first page, then each page continues from the previous page's cursor. */
export function pageUrl(path: string, previous: MessagingPage<unknown> | null): string | null {
  if (previous && !previous.nextCursor) return null; // reached the end
  const cursor = previous?.nextCursor ? `&cursor=${encodeURIComponent(previous.nextCursor)}` : '';
  return `${path}?limit=${MESSAGING_PAGE_SIZE}${cursor}`;
}
