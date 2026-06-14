import { Controller, Get, Param, Query } from '@nestjs/common';
import { MessagingService } from './messaging.service';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get(':conversationId')
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Query('limit') limit = 50,
    @Query('skip') skip = 0,
  ) {
    return this.messagingService.getMessages(conversationId, +limit, +skip);
  }
}
