import { api } from './auth';
import { Listing, ListingsQuery } from '@/types/listing';

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    lastPage: number;
  };
}

export const listingsApi = {
  getListings: async (query?: ListingsQuery): Promise<PaginatedResponse<Listing>> => {
    const response = await api.get('/listings', { params: query });
    return response.data;
  },

  getListing: async (id: string): Promise<Listing> => {
    const response = await api.get(`/listings/${id}`);
    return response.data;
  },

  createListing: async (data: Partial<Listing>): Promise<Listing> => {
    const response = await api.post('/listings', data);
    return response.data;
  },

  updateListing: async (id: string, data: Partial<Listing>): Promise<Listing> => {
    const response = await api.patch(`/listings/${id}`, data);
    return response.data;
  },

  deleteListing: async (id: string): Promise<void> => {
    await api.delete(`/listings/${id}`);
  },

  getMyListings: async (): Promise<Listing[]> => {
    const response = await api.get('/listings/my-listings');
    return response.data;
  },

  uploadImage: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};
