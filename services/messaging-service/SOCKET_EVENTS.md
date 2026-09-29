# Messaging — realtime events and REST contract

## Connection

Authenticate with the access token, never with a user id: the server takes the user from
the verified token.

```javascript
// Web
const socket = io(SOCKET_URL, { auth: { token: accessToken } });
// Mobile: an `Authorization: Bearer <token>` header in the handshake.
```

A rejected handshake arrives as `connect_error` and socket.io keeps retrying. Every socket
joins its user's own room, so new messages also reach an open inbox. Conversation rooms are
not kept across reconnects: re-emit `join_conversation` for open conversations on `connect`.

## Client → server

| Event | Payload | Notes |
|---|---|---|
| `join_conversation` | `{ conversationId }` or the id as a string | Checked against membership. Required before `mark_read` and `typing` |
| `leave_conversation` | `{ conversationId }` | |
| `send_message` | `{ conversationId, content }` | The ack is the stored message |
| `mark_read` | `{ conversationId }` | Moves your read position to the latest message |
| `typing` | `{ conversationId, isTyping }` | |

## Server → client

| Event | Payload |
|---|---|
| `new_message` | `Message` (to the conversation room and to both users' rooms) |
| `message_read` | `{ conversationId, userId, lastReadMessageId }` — every message with id ≤ `lastReadMessageId` sent by the other user is now read |
| `message_deleted` | `{ conversationId, messageId }` |
| `typing` | `{ conversationId, userId, isTyping }` |
| `presence_update` | `{ userId, status: 'online' \| 'offline' }` (to conversations that user had open) |

## REST (through the gateway: `/api/v1/conversations…`, mobile alias `/api/v1/messaging/conversations…`)

| Method | Path | Result |
|---|---|---|
| POST | `/conversations` `{ participants: [otherUserId], listingId? }` | `Conversation` (one per pair of users) |
| GET | `/conversations?limit=&cursor=` | `{ data: Conversation[], nextCursor }` — most recent activity first |
| GET | `/conversations/:id/messages?limit=&cursor=` (also `/messages/:id`) | `{ data: Message[], nextCursor }` — newest first |
| POST | `/conversations/:id/read` | `{ lastReadMessageId }` |
| POST | `/conversations/:id/messages/image` (multipart field `image`) | `Message` |
| POST | `/conversations/:id/block` | `Conversation` |
| DELETE | `/conversations/:id/messages/:messageId` | `{ deleted: true }` — own messages, within 5 minutes |

Pages are keyset pages: pass `nextCursor` back as `cursor`; `null` means the end. There is no
`skip`: every page costs the same, however deep.

```ts
interface Message {
  id: string;            // BIGINT as a string, increasing
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image';
  imageUrl: string | null;
  isRead: boolean;       // read by the other participant
  createdAt: string;
}

interface Conversation {
  id: string;
  participants: string[];            // [you, other]
  otherUserId: string;
  listingId: string | null;
  lastMessage: Message | null;       // summary; imageUrl is not included
  lastMessageAt: string | null;
  unreadCount: number;               // yours
  unreadCounts: Record<string, number>;
  blocked: boolean;
  createdAt: string;
  updatedAt: string;
}
```

Storage: Postgres, `db/migrations/0003_messaging_and_user_events.sql` (design notes there).
