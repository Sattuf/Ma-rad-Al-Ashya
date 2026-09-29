import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationEntity, ConversationMemberEntity } from '../entities/conversation.entity';
import { MessageEntity } from '../entities/message.entity';
import { MessagingService } from './messaging.service';
import { ConversationsController } from './conversations.controller';
import { MessagesController } from './messages.controller';
import { MessagingGateway } from './messaging.gateway';
import { FcmService } from '../fcm/fcm.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from './storage.service';

@Module({
  imports: [TypeOrmModule.forFeature([ConversationEntity, ConversationMemberEntity, MessageEntity])],
  controllers: [ConversationsController, MessagesController],
  providers: [MessagingService, MessagingGateway, FcmService, RedisService, StorageService],
})
export class MessagingModule {}
