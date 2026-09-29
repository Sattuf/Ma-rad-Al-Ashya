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
  type: 'text' | 'image';
  imageUrl?: string | null;
  createdAt: string;
  /** Read by the other participant (a read position on the server, not a flag per message). */
  isRead: boolean;
}

/** messaging-service conversation, as seen by the current user. */
export interface Conversation {
  id: string;
  /** User ids, the current user included. Names are loaded from users-service. */
  participants: string[];
  otherUserId: string;
  listingId?: string | null;
  lastMessage?: Message | null;
  lastMessageAt?: string | null;
  /** The current user's unread count. */
  unreadCount: number;
  /** Unread count per user id. */
  unreadCounts?: Record<string, number>;
  blocked: boolean;
  updatedAt: string;
}
