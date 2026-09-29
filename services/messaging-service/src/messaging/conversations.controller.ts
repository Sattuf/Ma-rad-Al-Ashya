import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Delete,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { MessagingService } from './messaging.service';
import { MessagingGateway } from './messaging.gateway';
import { AuthUser, JwtAuthGuard } from '../common/security';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly messagingGateway: MessagingGateway,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create or get a conversation with another user' })
  async createOrGetConversation(
    @Req() req: { user: AuthUser },
    @Body('participants') participants: string[],
    @Body('listingId') listingId?: string,
  ) {
    return this.messagingService.createOrGetConversation(req.user.userId, participants, listingId);
  }

  @Get()
  @ApiOperation({ summary: 'Get conversations of the current user' })
  async getConversations(
    @Req() req: { user: AuthUser },
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.messagingService.getConversations(req.user.userId, limit, cursor);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get messages of a conversation' })
  async getMessages(
    @Req() req: { user: AuthUser },
    @Param('id') conversationId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.messagingService.getMessages(conversationId, req.user.userId, limit, cursor);
  }

  @Post(':id/messages/image')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  @ApiOperation({ summary: 'Send an image message' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async sendImageMessage(
    @Req() req: { user: AuthUser },
    @Param('id') conversationId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_BYTES }),
          new FileTypeValidator({ fileType: /^image\/(png|jpe?g|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const sent = await this.messagingService.sendImageMessage(conversationId, req.user.userId, file);
    await this.messagingGateway.announceMessage(sent);
    return sent.message;
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark the conversation as read up to its latest message' })
  async markRead(@Req() req: { user: AuthUser }, @Param('id') conversationId: string) {
    const result = await this.messagingService.markRead(conversationId, req.user.userId);
    this.messagingGateway.announceRead(conversationId, req.user.userId, result.lastReadMessageId);
    return result;
  }

  @Post(':id/block')
  @ApiOperation({ summary: 'Block a conversation' })
  async blockConversation(@Req() req: { user: AuthUser }, @Param('id') conversationId: string) {
    return this.messagingService.blockConversation(conversationId, req.user.userId);
  }

  @Delete(':id/messages/:messageId')
  @ApiOperation({ summary: 'Delete a message within 5 minutes' })
  async deleteMessage(
    @Req() req: { user: AuthUser },
    @Param('id') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    await this.messagingService.deleteMessage(conversationId, messageId, req.user.userId);
    this.messagingGateway.announceDeleted(conversationId, messageId);
    return { deleted: true };
  }
}
