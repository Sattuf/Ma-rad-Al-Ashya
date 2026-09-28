import { api } from './auth';

export type DealStatus = 'pending_seller' | 'pending_buyer' | 'completed' | 'cancelled';

/** A deal between a buyer and a seller for one listing (transactions-service). */
export interface Deal {
  id: string;
  listingId: string;
  sellerId: string;
  buyerId: string;
  status: DealStatus;
  sellerConfirmedAt: string | null;
  buyerConfirmedAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  createdAt: string;
}

interface ServerDeal {
  id: string;
  listing_id: string;
  seller_id: string;
  buyer_id: string;
  status: DealStatus;
  seller_confirmed_at: string | null;
  buyer_confirmed_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_at: string;
}

const toDeal = (d: ServerDeal): Deal => ({
  id: d.id,
  listingId: d.listing_id,
  sellerId: d.seller_id,
  buyerId: d.buyer_id,
  status: d.status,
  sellerConfirmedAt: d.seller_confirmed_at,
  buyerConfirmedAt: d.buyer_confirmed_at,
  cancelledBy: d.cancelled_by,
  cancelReason: d.cancel_reason,
  createdAt: d.created_at,
});

export interface DealsPage {
  items: Deal[];
  total: number;
  page: number;
  limit: number;
}

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

  getTransactions: async (role: 'buyer' | 'seller', status?: string, page: number = 1, limit: number = 10): Promise<DealsPage> => {
    const params = new URLSearchParams({
      role,
      page: page.toString(),
      limit: limit.toString(),
    });
    if (status) {
      params.append('status', status);
    }
    const response = await api.get(`/transactions?${params.toString()}`);
    // Server shape: { items, total, page, limit } with snake_case rows.
    const data = response.data as { items: ServerDeal[]; total: number; page: number; limit: number };
    return { ...data, items: (data.items ?? []).map(toDeal) };
  },

  getTransaction: async (id: string): Promise<Deal> => {
    const response = await api.get(`/transactions/${id}`);
    return toDeal(response.data);
  },

  confirmTransaction: async (id: string): Promise<Deal> => {
    const response = await api.post(`/transactions/${id}/confirm`);
    return toDeal(response.data);
  },

  cancelTransaction: async (id: string, reason?: string): Promise<Deal> => {
    const response = await api.post(`/transactions/${id}/cancel`, { reason });
    return toDeal(response.data);
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
