import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagingService } from './messaging.service';

import { RedisService } from '../redis/redis.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, string>(); // userId -> socketId
  private socketUsers = new Map<string, string>(); // socketId -> userId

  constructor(
    private messagingService: MessagingService,
    private redisService: RedisService,
  ) {}

  async handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      this.userSockets.set(userId, client.id);
      this.socketUsers.set(client.id, userId);
      await this.redisService.setUserPresence(userId, 'online');
      this.server.emit('presence_update', { userId, status: 'online' });
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = this.socketUsers.get(client.id);
    if (userId) {
      this.userSockets.delete(userId);
      this.socketUsers.delete(client.id);
      await this.redisService.setUserPresence(userId, 'offline');
      this.server.emit('presence_update', { userId, status: 'offline' });
    }
  }

  @SubscribeMessage('join_conversation')
  handleJoinConversation(@MessageBody() data: { conversationId: string }, @ConnectedSocket() client: Socket) {
    client.join(`conversation_${data.conversationId}`);
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: { conversationId: string; senderId: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const message = await this.messagingService.sendMessage(data.conversationId, data.senderId, data.content);
    // Emit to conversation room
    this.server.to(`conversation_${data.conversationId}`).emit('new_message', message);
    return message;
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @MessageBody() data: { conversationId: string; userId: string },
  ) {
    await this.messagingService.markRead(data.conversationId, data.userId);
    this.server.to(`conversation_${data.conversationId}`).emit('messages_read', {
      conversationId: data.conversationId,
      userId: data.userId,
    });
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { conversationId: string; userId: string; isTyping: boolean },
  ) {
    this.server.to(`conversation_${data.conversationId}`).emit('user_typing', {
      conversationId: data.conversationId,
      userId: data.userId,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('update_presence')
  handleUpdatePresence(
    @MessageBody() data: { userId: string; status: string },
  ) {
    this.server.emit('presence_update', { userId: data.userId, status: data.status });
  }
}
