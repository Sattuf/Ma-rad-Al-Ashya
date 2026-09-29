import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MessagingService } from './messaging.service';
import { AuthUser, JwtAuthGuard } from '../common/security';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get(':conversationId')
  @ApiOperation({ summary: 'Get messages for a conversation' })
  async getMessages(
    @Req() req: { user: AuthUser },
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.messagingService.getMessages(conversationId, req.user.userId, limit, cursor);
  }
}
