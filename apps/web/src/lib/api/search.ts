import useSWR from 'swr';
import { listingsApi } from './listings';

/**
 * Search-as-you-type suggestions for the navbar. Full search lives on /listings, which
 * uses the same endpoint with filters.
 */
export const searchApi = {
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
