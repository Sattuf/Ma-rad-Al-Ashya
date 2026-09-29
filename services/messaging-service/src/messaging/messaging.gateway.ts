import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { MessagingService, SentMessage } from './messaging.service';

import { RedisService } from '../redis/redis.service';
import { FcmService } from '../fcm/fcm.service';
import { corsOrigins, extractBearerToken, verifyAccessToken } from '../common/security';

type ConversationRef = string | { conversationId?: string };

const roomFor = (conversationId: string) => `conversation_${conversationId}`;
/** Every socket of a user joins this room, so new messages reach an open inbox too. */
const userRoom = (userId: string) => `user_${userId}`;

@WebSocketGateway({ cors: { origin: corsOrigins() } })
export class MessagingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagingGateway.name);

  constructor(
    private messagingService: MessagingService,
    private redisService: RedisService,
    private fcmService: FcmService,
  ) {}

  /**
   * Authenticates in the handshake middleware. A rejection here reaches the client as
   * `connect_error`, after which socket.io keeps retrying (with a refreshed token when the
   * client passes `auth` as a callback). Disconnecting from handleConnection instead would
   * stop the client's automatic reconnection for good.
   *
   * The user id comes only from a verified access token — never from the client's
   * query string or payload (web sends `auth.token`, mobile an Authorization header).
   */
  afterInit(server: Server) {
    server.use((socket, next) => {
      const token =
        (typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : null) ??
        extractBearerToken(socket.handshake.headers?.authorization);
      try {
        if (!token) throw new Error('missing token');
        socket.data.userId = verifyAccessToken(token).userId;
        socket.data.conversations = new Set<string>();
        next();
      } catch {
        next(new Error('unauthorized'));
      }
    });
  }

  async handleConnection(client: Socket) {
    if (!client.data.userId) {
      client.disconnect(true);
      return;
    }
    client.join(userRoom(client.data.userId));
    await this.redisService.addConnection(client.data.userId, client.id);
  }

  async handleDisconnect(client: Socket) {
    const userId: string | undefined = client.data.userId;
    if (!userId) return;
    const stillOnline = await this.redisService.removeConnection(userId, client.id);
    if (stillOnline) return; // another tab/device is still connected
    // Presence goes only to the conversations this user had open, not to every connected client.
    for (const conversationId of client.data.conversations ?? []) {
      this.server.to(roomFor(conversationId)).emit('presence_update', { userId, status: 'offline' });
    }
  }

  private requireUser(client: Socket): string {
    const userId = client.data.userId;
    if (!userId) throw new WsException('Unauthorized');
    // Any activity counts as a heartbeat for the presence TTL.
    void this.redisService.refreshPresence(userId).catch(() => undefined);
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
      await this.messagingService.assertParticipant(conversationId, userId);
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
      const sent = await this.messagingService.sendMessage(data?.conversationId, senderId, data?.content);
      await this.announceMessage(sent);
      return sent.message;
    } catch (err) {
      throw new WsException(err?.message ?? 'Failed to send message');
    }
  }

  /**
   * Delivers a stored message: to the open conversation and to every recipient's other
   * sockets (inbox), in one emit (socket.io de-duplicates sockets across rooms). Offline
   * recipients get a push notification. Recipients and listing come back from the insert
   * statement itself, so no extra query here.
   */
  async announceMessage({ message, recipientIds, listingId }: SentMessage) {
    this.server
      .to([roomFor(message.conversationId), userRoom(message.senderId), ...recipientIds.map(userRoom)])
      .emit('new_message', message);

    if (listingId) {
      await this.redisService.incr(`listing:messages:${listingId}`);
    }

    for (const recipientId of recipientIds) {
      const status = await this.redisService.getUserPresence(recipientId);
      if (status !== 'online') {
        this.fcmService.sendNotification(recipientId, 'رسالة جديدة', message.content, {
          conversationId: message.conversationId,
          messageId: message.id,
        });
      }
    }
  }

  announceRead(conversationId: string, userId: string, lastReadMessageId: string) {
    this.server.to(roomFor(conversationId)).emit('message_read', { conversationId, userId, lastReadMessageId });
  }

  announceDeleted(conversationId: string, messageId: string) {
    this.server.to(roomFor(conversationId)).emit('message_deleted', { conversationId, messageId });
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(@MessageBody() data: { conversationId: string }, @ConnectedSocket() client: Socket) {
    const userId = this.requireUser(client);
    const conversationId = this.requireJoined(client, data?.conversationId);
    const { lastReadMessageId } = await this.messagingService.markRead(conversationId, userId);
    this.announceRead(conversationId, userId, lastReadMessageId);
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { conversationId: string; isTyping?: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.requireUser(client);
    const conversationId = this.requireJoined(client, data?.conversationId);
    client.to(roomFor(conversationId)).emit('typing', {
      conversationId,
      userId,
      isTyping: data?.isTyping !== false,
    });
  }
}
