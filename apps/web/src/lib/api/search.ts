import useSWR from 'swr';
import { api } from './auth';
import { listingsApi, type PaginatedResponse } from './listings';
import { errorKind } from '@/lib/errors';
import { visitorId } from '@/lib/visitor';
import type { Listing, ListingsQuery } from '@/types/listing';

export type Variant = 'A' | 'B';

/** One page of results; `variant` is null when the page did not come from the experiment. */
export type SearchPage = PaginatedResponse<Listing> & { variant: Variant | null };

interface RankedIds {
  ids: string[];
  total: number;
  page: number;
  limit: number;
  variant: Variant;
}

/**
 * Text search through search-service, the A/B ranking experiment: it assigns the visitor a
 * sticky variant, ranks ids, and counts the search. Listings are then hydrated in one batch
 * (keeping the ranking order and dropping any that stopped being active since indexing).
 *
 * If search-service is unavailable the same query runs against the database instead, so
 * people still get results; those pages carry variant null and are not part of the test.
 */
async function rankedSearch(query: ListingsQuery): Promise<SearchPage> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  try {
    const { data } = await api.get<RankedIds>('/search', {
      params: {
        q: query.search,
        categoryId: query.categoryId,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        page,
        limit,
        session_id: visitorId(),
      },
    });
    const byId = new Map<string, Listing>();
    if (data.ids.length) {
      const hydrated = await listingsApi.getListings({ ids: data.ids.join(','), limit: data.ids.length });
      hydrated.data.forEach((l) => l.status === 'active' && byId.set(l.id, l));
    }
    return {
      data: data.ids.map((id) => byId.get(id)).filter((l): l is Listing => !!l),
      meta: { page: data.page, limit: data.limit, total: data.total, lastPage: Math.max(1, Math.ceil(data.total / data.limit)) },
      variant: data.variant,
    };
  } catch (err) {
    const kind = errorKind(err);
    if (kind !== 'server' && kind !== 'network' && kind !== 'timeout') throw err;
    return { ...(await listingsApi.getListings({ ...query, page, limit })), variant: null };
  }
}

export const searchApi = {
  /** Browsing (no text) reads the database directly; text searches go through the experiment. */
  page: (query: ListingsQuery): Promise<SearchPage> =>
    query.search?.trim() ? rankedSearch(query) : listingsApi.getListings(query).then((p) => ({ ...p, variant: null })),

  /** Records a click on a ranked result (fire-and-forget; never blocks navigation). */
  trackClick: (params: { query: string; listingId: string; position: number; variant: Variant }) => {
    api
      .post('/search/track-click', {
        query: params.query,
        listing_id: params.listingId,
        position: params.position,
        variant: params.variant,
        session_id: visitorId(),
      })
      .catch(() => undefined);
  },

  /** Search-as-you-type suggestions for the navbar (titles only; no ranking, not counted). */
  autocomplete: async (q: string): Promise<{ title: string; id: string }[]> => {
    if (!q || q.trim().length < 2) return [];
    const page = await listingsApi.getListings({ search: q.trim(), limit: 5 });
    return page.data.map((item) => ({ title: item.title, id: item.id }));
  },
};

export const useAutocomplete = (q: string) =>
  useSWR<{ title: string; id: string }[]>(q && q.trim().length >= 2 ? ['/search/autocomplete', q.trim()] : null, () => searchApi.autocomplete(q), {
    keepPreviousData: true,
  });
