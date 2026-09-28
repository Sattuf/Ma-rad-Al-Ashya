import useSWR from 'swr';
import { api } from '@/lib/api/auth';
import { listingsApi } from '@/lib/api/listings';
import { useAuthStore } from '@/lib/store/auth-store';
import type { Listing } from '@/types/listing';

/** personalization-service: GET /recommendations → { listings: [{ id, … }], based_on }. */
interface RecommendationsResponse {
  listings: { id: string }[];
  based_on: string;
}

/**
 * Personalized picks for a signed-in user. The recommendation index has no images or
 * currency, so the ids are resolved to full listings in one batch request (which,
 * unlike GET /listings/:id, does not count views). Guests get nothing here: the home
 * page shows the latest listings instead.
 */
export function useRecommendations(limit = 4) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data, error, isLoading } = useSWR(
    isAuthenticated ? ['/recommendations', limit] : null,
    async (): Promise<{ listings: Listing[]; personalized: boolean }> => {
      const { data: rec } = await api.get<RecommendationsResponse>('/recommendations', { params: { limit } });
      const ids = (rec?.listings ?? []).map((l) => l.id).filter(Boolean);
      if (!ids.length) return { listings: [], personalized: false };
      const page = await listingsApi.getListings({ ids: ids.join(','), limit: ids.length });
      const byId = new Map(page.data.map((l) => [l.id, l]));
      // Keep the recommender's order; drop listings that were sold or removed since indexing.
      const listings = ids.map((id) => byId.get(id)).filter((l): l is Listing => !!l);
      return { listings, personalized: rec.based_on !== 'cold_start' };
    },
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  return {
    listings: data?.listings ?? [],
    personalized: data?.personalized ?? false,
    isLoading: isAuthenticated && isLoading,
    error,
  };
}
