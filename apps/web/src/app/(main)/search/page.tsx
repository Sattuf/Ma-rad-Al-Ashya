import { redirect } from 'next/navigation';

/**
 * Old search URL. Search lives on /listings (text, category and price filters that the
 * API actually supports); this keeps shared /search?q=… links working.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
  const next = new URLSearchParams();
  const search = one(params.q) || one(params.search);
  if (search) next.set('search', search.slice(0, 100));
  for (const key of ['minPrice', 'maxPrice', 'categoryId'] as const) if (one(params[key])) next.set(key, one(params[key]));
  const qs = next.toString();
  redirect(qs ? `/listings?${qs}` : '/listings');
}
