import { api } from './auth';
import { CreateListingInput, Listing, ListingsQuery } from '@/types/listing';

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
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

  createListing: async (data: CreateListingInput): Promise<Listing> => {
    const response = await api.post('/listings', data);
    return response.data;
  },

  updateListing: async (id: string, data: Partial<CreateListingInput>): Promise<Listing> => {
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

  /** Images are attached to an existing listing (max 10, 5MB, png/jpeg). */
  uploadImage: async (listingId: string, file: File): Promise<{ imageUrl: string; thumbnailUrl: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/listings/${listingId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteImage: async (listingId: string, imageId: string): Promise<void> => {
    await api.delete(`/listings/${listingId}/images/${imageId}`);
  },

  /** Owners may set active or sold; deletion goes through deleteListing. */
  updateStatus: async (id: string, status: 'active' | 'sold'): Promise<Listing> => {
    const response = await api.patch(`/listings/${id}/status`, { status });
    return response.data;
  },
};
