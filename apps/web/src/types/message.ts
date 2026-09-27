export interface User {
  id: string;
  name: string;
  avatar?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type?: 'text' | 'image';
  imageUrl?: string;
  createdAt: string;
  readAt?: string;
}

/** messaging-service conversation (Mongo document; `id` is added from `_id` by fetchMessagingPage). */
export interface Conversation {
  id: string;
  /** User ids, the current user included. Names are loaded from users-service. */
  participants: string[];
  listingId?: string;
  lastMessage?: Message | null;
  /** Unread count per user id. */
  unreadCounts?: Record<string, number>;
  updatedAt: string;
}
