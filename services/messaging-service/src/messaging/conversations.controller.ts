import { Controller, Get, Post, Body, Param, Query, Req, Headers } from '@nestjs/common';
import { MessagingService } from './messaging.service';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post()
  async createOrGetConversation(@Body('participants') participants: string[]) {
    return this.messagingService.createOrGetConversation(participants);
  }

  @Get()
  async getConversations(@Headers('x-user-id') userId: string) {
    if (!userId) {
      return []; // fallback if not provided by gateway
    }
    return this.messagingService.getConversations(userId);
  }
}
