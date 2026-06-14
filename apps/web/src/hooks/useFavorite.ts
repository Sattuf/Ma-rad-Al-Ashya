import useSWR from 'swr';
import { favoritesApi } from '@/lib/api/favorites';

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
  const key = listingId ? `/users/favorites/${listingId}/check` : null;
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
