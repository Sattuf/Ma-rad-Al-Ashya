import useSWR from 'swr';
import { api } from '@/lib/api/auth';
import { listingsApi } from '@/lib/api/listings';
import { useAuthStore } from '@/lib/store/auth-store';
import { Listing } from '@/types/listing';

export function useRecommendations() {
  const { isAuthenticated } = useAuthStore();

  const fetcher = async () => {
    // Only attempt to call recommendations if authenticated
    if (!isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await api.get('/recommendations');
      return response.data as Listing[];
    } catch (error) {
      console.warn('Personalized recommendations API failed, falling back to cold start');
      // If personalized fails, let SWR error handler or fallback logic handle it
      throw error;
    }
  };

  const { data, error, isLoading, mutate } = useSWR(
    isAuthenticated ? '/recommendations/personalized' : null,
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  return {
    listings: data || [],
    isLoading: isAuthenticated ? isLoading : false,
    error,
    mutate,
  };
}

export function useColdStartRecommendations() {
  const fetcher = async () => {
    try {
      const response = await api.get('/recommendations/cold-start');
      return response.data as Listing[];
    } catch (error) {
      console.warn('Cold start recommendations API failed, falling back to general listings');
      // Fallback: fetch active listings
      const res = await listingsApi.getListings({ limit: 4 });
      return res.data;
    }
  };

  const { data, error, isLoading, mutate } = useSWR(
    '/recommendations/cold-start',
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  return {
    listings: data || [],
    isLoading,
    error,
    mutate,
  };
}

/**
 * A combined hook that tries to fetch personalized recommendations first if the user is authenticated.
 * Falls back to cold-start recommendations if not authenticated or if the personalized endpoint fails.
 */
export function useSuggestedListings() {
  const { isAuthenticated } = useAuthStore();
  const { listings: personalized, isLoading: isPersLoading, error: persError } = useRecommendations();
  const { listings: coldStart, isLoading: isColdLoading, error: coldError } = useColdStartRecommendations();

  // Determine if we should show personalized recommendations
  const showPersonalized = isAuthenticated && !persError && personalized && personalized.length > 0;
  
  const listings = showPersonalized ? personalized : coldStart;
  const isLoading = isAuthenticated ? (isPersLoading && isColdLoading) : isColdLoading;

  return {
    listings: listings.slice(0, 4), // Guarantee maximum of 4 listings as requested
    isLoading,
    isPersonalized: showPersonalized,
    error: showPersonalized ? null : coldError,
  };
}
