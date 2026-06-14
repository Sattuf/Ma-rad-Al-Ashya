import { Controller, Get, Post, Body, Param, Query, Req, Headers, UseInterceptors, UploadedFile, Delete } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { MessagingService } from './messaging.service';

import { MessagingGateway } from './messaging.gateway';

@ApiTags('Conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly messagingGateway: MessagingGateway,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create or get a conversation' })
  async createOrGetConversation(@Body('participants') participants: string[]) {
    return this.messagingService.createOrGetConversation(participants);
  }

  @Get()
  @ApiOperation({ summary: 'Get all conversations for a user' })
  async getConversations(@Headers('x-user-id') userId: string) {
    if (!userId) {
      return []; // fallback if not provided by gateway
    }
    return this.messagingService.getConversations(userId);
  }

  @Post(':id/messages/image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Send an image message' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async sendImageMessage(
    @Param('id') conversationId: string,
    @Headers('x-user-id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!userId) throw new Error('Unauthorized');
    const message = await this.messagingService.sendImageMessage(conversationId, userId, file);
    await this.messagingGateway.handleNewMessageSent(message);
    return message;
  }

  @Post(':id/block')
  @ApiOperation({ summary: 'Block a conversation' })
  async blockConversation(
    @Param('id') conversationId: string,
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) throw new Error('Unauthorized');
    return this.messagingService.blockConversation(conversationId, userId);
  }

  @Delete(':id/messages/:messageId')
  @ApiOperation({ summary: 'Delete a message within 5 minutes' })
  async deleteMessage(
    @Param('id') conversationId: string,
    @Param('messageId') messageId: string,
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) throw new Error('Unauthorized');
    return this.messagingService.deleteMessage(conversationId, messageId, userId);
  }
}
