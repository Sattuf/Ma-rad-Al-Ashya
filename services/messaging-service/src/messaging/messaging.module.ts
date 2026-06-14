import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Conversation, ConversationSchema } from '../schemas/conversation.schema';
import { Message, MessageSchema } from '../schemas/message.schema';
import { MessagingService } from './messaging.service';
import { ConversationsController } from './conversations.controller';
import { MessagesController } from './messages.controller';
import { MessagingGateway } from './messaging.gateway';
import { FcmService } from '../fcm/fcm.service';
import { RedisService } from '../redis/redis.service';

import { StorageService } from './storage.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
  ],
  controllers: [ConversationsController, MessagesController],
  providers: [MessagingService, MessagingGateway, FcmService, RedisService, StorageService],
})
export class MessagingModule {}
