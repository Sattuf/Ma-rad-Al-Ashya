import { api } from '@/lib/api/auth';

export const MESSAGING_PAGE_SIZE = 20;

/**
 * messaging-service pages with limit/skip and returns a plain array of Mongo documents
 * (`_id`). The UI works with `{ data, hasMore }` pages and `id` — adapted here.
 */
export async function fetchMessagingPage<T>(url: string): Promise<{ data: T[]; hasMore: boolean }> {
  const res = await api.get(url);
  const items: any[] = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
  return {
    data: items.map((item) => ({ ...item, id: item.id ?? item._id })) as T[],
    hasMore: items.length === MESSAGING_PAGE_SIZE,
  };
}

export const pageQuery = (pageIndex: number) =>
  `limit=${MESSAGING_PAGE_SIZE}&skip=${pageIndex * MESSAGING_PAGE_SIZE}`;
