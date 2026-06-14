import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MessagingService } from './messaging.service';

@ApiTags('Messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get(':conversationId')
  @ApiOperation({ summary: 'Get messages for a conversation' })
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Query('limit') limit = 50,
    @Query('skip') skip = 0,
  ) {
    return this.messagingService.getMessages(conversationId, +limit, +skip);
  }
}
