import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation } from '../schemas/conversation.schema';
import { Message } from '../schemas/message.schema';
import { FcmService } from '../fcm/fcm.service';

@Injectable()
export class MessagingService {
  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<Conversation>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    private fcmService: FcmService,
  ) {}

  async createOrGetConversation(participants: string[]): Promise<Conversation> {
    const existing = await this.conversationModel.findOne({
      participants: { $all: participants, $size: participants.length },
    });
    if (existing) return existing;

    const initialUnread: Record<string, number> = {};
    participants.forEach((p) => (initialUnread[p] = 0));

    const conversation = new this.conversationModel({
      participants,
      unreadCounts: initialUnread,
    });
    return conversation.save();
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    return this.conversationModel
      .find({ participants: userId })
      .populate('lastMessage')
      .sort({ updatedAt: -1 })
      .exec();
  }

  async getMessages(conversationId: string, limit = 50, skip = 0): Promise<Message[]> {
    return this.messageModel
      .find({ conversationId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async sendMessage(conversationId: string, senderId: string, content: string): Promise<Message> {
    const message = new this.messageModel({
      conversationId,
      senderId,
      content,
    });
    await message.save();

    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    conversation.lastMessage = message._id as Types.ObjectId;
    
    // increment unread counts for all participants except sender
    const newUnread = { ...conversation.unreadCounts };
    conversation.participants.forEach((p) => {
      if (p !== senderId) {
        newUnread[p] = (newUnread[p] || 0) + 1;
      }
    });
    conversation.unreadCounts = newUnread;
    await conversation.save();

    // send FCM to other participants
    conversation.participants.forEach((p) => {
      if (p !== senderId) {
        this.fcmService.sendNotification(p, 'New Message', content, { conversationId, messageId: message._id });
      }
    });

    return message;
  }

  async markRead(conversationId: string, userId: string): Promise<void> {
    await this.messageModel.updateMany(
      { conversationId, senderId: { $ne: userId }, isRead: false },
      { $set: { isRead: true } },
    );

    const conversation = await this.conversationModel.findById(conversationId);
    if (conversation) {
      const newUnread = { ...conversation.unreadCounts };
      newUnread[userId] = 0;
      conversation.unreadCounts = newUnread;
      await conversation.save();
    }
  }
}
