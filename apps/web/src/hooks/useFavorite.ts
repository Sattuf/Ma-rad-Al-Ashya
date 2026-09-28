import useSWR from 'swr';
import { favoritesApi } from '@/lib/api/favorites';
import { useAuthStore } from '@/lib/store/auth-store';

export function useFavorites(page: number = 1, limit: number = 10) {
  const { data, error, isLoading, mutate } = useSWR(
    `/users/favorites?page=${page}&limit=${limit}`,
    () => favoritesApi.getFavorites(page, limit)
  );

  return {
    favorites: data,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useFavoriteCheck(listingId: string) {
  // Guests have no favorites: skip the request instead of one 401 per card.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const key = listingId && isAuthenticated ? `/users/favorites/${listingId}/check` : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => favoritesApi.checkFavorite(listingId)
  );

  const toggleFavorite = async () => {
    if (!listingId) return;
    const currentStatus = data?.isFavorite ?? false;
    
    // Optimistic update
    mutate({ isFavorite: !currentStatus }, false);
    
    try {
      await favoritesApi.toggleFavorite(listingId, currentStatus);
      mutate({ isFavorite: !currentStatus }); // revalidate after update
    } catch (err) {
      // Revert on error
      mutate({ isFavorite: currentStatus });
      throw err;
    }
  };

  return {
    isFavorite: data?.isFavorite ?? false,
    isLoading,
    isError: error,
    toggleFavorite,
    mutate,
  };
}
