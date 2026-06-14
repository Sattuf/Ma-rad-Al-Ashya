# WebSocket Events

## Connection

Connect to the Socket.IO server at `/` (default path) or configure your client. Pass the `userId` in the query to identify the user for presence and message delivery.

```javascript
const socket = io('http://localhost:3004', {
  query: { userId: 'user-123' }
});
```

## Client -> Server Events

### `join_conversation`
Join a specific conversation room to receive messages and typing events.
- **Payload**: `{ conversationId: string }`

### `send_message`
Send a new message to a conversation.
- **Payload**: `{ conversationId: string, senderId: string, content: string }`
- **Response**: Emits `new_message` to the room.

### `mark_read`
Mark all unread messages in a conversation as read by the user.
- **Payload**: `{ conversationId: string, userId: string }`
- **Response**: Emits `messages_read` to the room.

### `typing`
Indicate that a user is typing (or stopped typing) in a conversation.
- **Payload**: `{ conversationId: string, userId: string, isTyping: boolean }`
- **Response**: Emits `user_typing` to the room.

### `update_presence`
Manually update user's online presence (optional, as connection/disconnection handles basic presence).
- **Payload**: `{ userId: string, status: string }`

---

## Server -> Client Events

### `new_message`
Received when a new message is sent to a joined conversation.
- **Payload**: `Message` object

### `messages_read`
Received when a user marks messages as read in a joined conversation.
- **Payload**: `{ conversationId: string, userId: string }`

### `user_typing`
Received when another user starts or stops typing.
- **Payload**: `{ conversationId: string, userId: string, isTyping: boolean }`

### `presence_update`
Received globally when a user connects or disconnects.
- **Payload**: `{ userId: string, status: 'online' | 'offline' }`
