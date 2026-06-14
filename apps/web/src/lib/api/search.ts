import useSWR from 'swr';
import { api } from './auth';
import { Listing, PaginatedResponse } from '@/types/listing';

export interface SearchQuery {
  q?: string;
  type?: string;
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  city?: string;
  page?: number;
  limit?: number;
}

export const searchApi = {
  searchListings: async (query: SearchQuery): Promise<PaginatedResponse<Listing>> => {
    // Clear out empty parameters
    const params = Object.fromEntries(
      Object.entries(query).filter(([_, v]) => v !== '' && v !== undefined)
    );
    const response = await api.get('/listings', { params });
    return response.data;
  },

  autocomplete: async (q: string): Promise<{ title: string; id: string }[]> => {
    if (!q || q.length < 2) return [];
    
    try {
      // In a real scenario, this might be a dedicated /search/autocomplete endpoint.
      // We'll fallback to /listings?q=...&limit=5
      const response = await api.get('/listings', { params: { q, limit: 5 } });
      
      // If the response is PaginatedResponse, we map over data
      if (response.data && Array.isArray(response.data.data)) {
        return response.data.data.map((item: Listing) => ({
          title: item.title,
          id: item.id
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Autocomplete error:', error);
      return [];
    }
  }
};

export const useSearch = (query: SearchQuery) => {
  return useSWR<PaginatedResponse<Listing>>(
    ['/listings/search', JSON.stringify(query)],
    () => searchApi.searchListings(query),
    { keepPreviousData: true }
  );
};

export const useAutocomplete = (q: string) => {
  return useSWR<{ title: string; id: string }[]>(
    q && q.length >= 2 ? ['/search/autocomplete', q] : null,
    () => searchApi.autocomplete(q)
  );
};
