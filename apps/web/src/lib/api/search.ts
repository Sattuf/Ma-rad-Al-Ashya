import useSWR from 'swr';
import { api } from './auth';
import { Listing } from '@/types/listing';
import { PaginatedResponse } from './listings';

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
  ab_variant?: string;
  session_id?: string;
}

export interface SearchResponse extends PaginatedResponse<Listing> {
  variant?: string;
}

export const searchApi = {
  searchListings: async (query: SearchQuery): Promise<SearchResponse> => {
    // Clear out empty parameters
    const params = Object.fromEntries(
      Object.entries(query).filter(([_, v]) => v !== '' && v !== undefined)
    );
    const response = await api.get('/listings', { params });
    // Expecting variant to be returned from backend in response.data.variant
    return response.data;
  },

  autocomplete: async (q: string): Promise<{ title: string; id: string }[]> => {
    if (!q || q.length < 2) return [];
    
    try {
      const response = await api.get('/listings', { params: { q, limit: 5 } });
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
  },

  trackClick: (params: { query: string; listing_id: string; position: number; variant: string; session_id: string }) => {
    api.post('/search/track-click', params).catch(console.error);
  }
};

export const useSearch = (query: SearchQuery) => {
  return useSWR<SearchResponse>(
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
