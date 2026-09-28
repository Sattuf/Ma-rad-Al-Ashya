import { api } from './auth';
import { PaginatedResponse } from './listings';
import { Listing } from '@/types/listing';

export const favoritesApi = {
  toggleFavorite: async (listingId: string, isCurrentlyFavorite: boolean): Promise<void> => {
    if (isCurrentlyFavorite) {
      await api.delete(`/users/favorites/${listingId}`);
    } else {
      await api.post(`/users/favorites/${listingId}`);
    }
  },

  getFavorites: async (page: number = 1, limit: number = 10): Promise<PaginatedResponse<Listing>> => {
    const response = await api.get('/users/favorites', { params: { page, limit } });
    return response.data;
  },

  checkFavorite: async (listingId: string): Promise<{ isFavorite: boolean }> => {
    const response = await api.get(`/users/favorites/${listingId}/check`);
    // users-service answers { favorited }.
    return { isFavorite: !!response.data?.favorited };
  },
};
