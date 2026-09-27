import { api } from './auth';

export interface Review {
  id: string;
  reviewer_id: string;
  listing_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface RatingSummary {
  total_reviews: number;
  average_rating: number | string;
  rating_1_count?: number;
  rating_2_count?: number;
  rating_3_count?: number;
  rating_4_count?: number;
  rating_5_count?: number;
}

/** GET /users/:id/reviews (transactions-service) → { summary, reviews }. */
export interface UserReviews {
  summary: RatingSummary;
  reviews: Review[];
}

export const transactionsApi = {
  createTransaction: async (listingId: string, sellerId: string) => {
    const response = await api.post('/transactions', { listing_id: listingId, seller_id: sellerId });
    return response.data;
  },

  getTransactions: async (role: 'buyer' | 'seller', status?: string, page: number = 1, limit: number = 10) => {
    const params = new URLSearchParams({
      role,
      page: page.toString(),
      limit: limit.toString(),
    });
    if (status) {
      params.append('status', status);
    }
    const response = await api.get(`/transactions?${params.toString()}`);
    return response.data;
  },

  getTransaction: async (id: string) => {
    const response = await api.get(`/transactions/${id}`);
    return response.data;
  },

  confirmTransaction: async (id: string) => {
    const response = await api.post(`/transactions/${id}/confirm`);
    return response.data;
  },

  cancelTransaction: async (id: string, reason?: string) => {
    const response = await api.post(`/transactions/${id}/cancel`, { reason });
    return response.data;
  },

  createReview: async (transactionId: string, rating: number, comment?: string) => {
    const response = await api.post(`/transactions/${transactionId}/reviews`, { rating, comment });
    return response.data;
  },

  getUserReviews: async (userId: string, page: number = 1, limit: number = 10): Promise<UserReviews> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    const response = await api.get(`/users/${userId}/reviews?${params.toString()}`);
    return response.data;
  },
};
