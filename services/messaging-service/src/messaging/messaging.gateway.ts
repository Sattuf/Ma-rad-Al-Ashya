import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { MessagingService } from './messaging.service';

import { RedisService } from '../redis/redis.service';
import { FcmService } from '../fcm/fcm.service';
import { corsOrigins, extractBearerToken, verifyAccessToken } from '../common/security';

type ConversationRef = string | { conversationId?: string };

const roomFor = (conversationId: string) => `conversation_${conversationId}`;

@WebSocketGateway({ cors: { origin: corsOrigins() } })
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagingGateway.name);

  constructor(
    private messagingService: MessagingService,
    private redisService: RedisService,
    private fcmService: FcmService,
  ) {}

  /**
   * The user id comes only from a verified access token — never from the client's
   * query string or payload (web sends `auth.token`, mobile an Authorization header).
   */
  async handleConnection(client: Socket) {
    const token =
      (typeof client.handshake.auth?.token === 'string' ? client.handshake.auth.token : null) ??
      extractBearerToken(client.handshake.headers?.authorization);

    try {
      if (!token) throw new Error('missing token');
      const user = verifyAccessToken(token);
      client.data.userId = user.userId;
      client.data.conversations = new Set<string>();
      await this.redisService.setUserPresence(user.userId, 'online');
    } catch {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId: string | undefined = client.data.userId;
    if (!userId) return;
    await this.redisService.setUserPresence(userId, 'offline');
    // Presence goes only to the conversations this user had open, not to every connected client.
    for (const conversationId of client.data.conversations ?? []) {
      this.server.to(roomFor(conversationId)).emit('presence_update', { userId, status: 'offline' });
    }
  }

  private requireUser(client: Socket): string {
    const userId = client.data.userId;
    if (!userId) throw new WsException('Unauthorized');
    return userId;
  }

  /** Only rooms the socket joined after a membership check may be used. */
  private requireJoined(client: Socket, conversationId: unknown): string {
    if (typeof conversationId !== 'string' || !client.data.conversations?.has(conversationId)) {
      throw new WsException('Join the conversation first');
    }
    return conversationId;
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(@MessageBody() data: ConversationRef, @ConnectedSocket() client: Socket) {
    const userId = this.requireUser(client);
    const conversationId = typeof data === 'string' ? data : data?.conversationId;
    if (typeof conversationId !== 'string') throw new WsException('conversationId is required');

    try {
      await this.messagingService.getConversationForParticipant(conversationId, userId);
    } catch {
      throw new WsException('Conversation not found');
    }

    client.join(roomFor(conversationId));
    client.data.conversations.add(conversationId);
    client.to(roomFor(conversationId)).emit('presence_update', { userId, status: 'online' });
    return { joined: conversationId };
  }

  @SubscribeMessage('leave_conversation')
  handleLeaveConversation(@MessageBody() data: ConversationRef, @ConnectedSocket() client: Socket) {
    const conversationId = typeof data === 'string' ? data : data?.conversationId;
    if (typeof conversationId === 'string') {
      client.leave(roomFor(conversationId));
      client.data.conversations?.delete(conversationId);
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: { conversationId: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const senderId = this.requireUser(client);
    try {
      const message = await this.messagingService.sendMessage(data?.conversationId, senderId, data?.content);
      await this.handleNewMessageSent(message);
      return message;
    } catch (err) {
      throw new WsException(err?.message ?? 'Failed to send message');
    }
  }

  async handleNewMessageSent(message: any) {
    const conversationId = message.conversationId.toString();
    const senderId = message.senderId;
    const content = message.content;

    this.server.to(roomFor(conversationId)).emit('new_message', message);

    const conversation = await this.messagingService.getConversationById(conversationId);

    if (conversation.listingId) {
      await this.redisService.incr(`listing:messages:${conversation.listingId}`);
    }

    for (const p of conversation.participants) {
      if (p !== senderId) {
        const status = await this.redisService.getUserPresence(p);
        if (status !== 'online') {
          this.fcmService.sendNotification(p, 'New Message', content, {
            conversationId,
            messageId: message._id.toString(),
          });
        }
      }
    }
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(@MessageBody() data: { conversationId: string }, @ConnectedSocket() client: Socket) {
    const userId = this.requireUser(client);
    const conversationId = this.requireJoined(client, data?.conversationId);
    await this.messagingService.markRead(conversationId, userId);
    this.server.to(roomFor(conversationId)).emit('messages_read', { conversationId, userId });
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { conversationId: string; isTyping?: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.requireUser(client);
    const conversationId = this.requireJoined(client, data?.conversationId);
    client.to(roomFor(conversationId)).emit('user_typing', {
      conversationId,
      userId,
      isTyping: data?.isTyping !== false,
    });
  }
}
