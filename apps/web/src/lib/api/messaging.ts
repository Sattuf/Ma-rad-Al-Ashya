import { api } from './auth';

export const messagingApi = {
  /** Opens (or reuses) the conversation between the current user and a seller. */
  startConversation: async (sellerId: string, listingId?: string): Promise<{ id: string }> => {
    const response = await api.post('/conversations', { participants: [sellerId], listingId });
    return { id: response.data.id ?? response.data._id };
  },
};
