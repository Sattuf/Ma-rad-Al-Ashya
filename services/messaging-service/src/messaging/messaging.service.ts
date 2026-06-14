import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation } from '../schemas/conversation.schema';
import { Message } from '../schemas/message.schema';
import { FcmService } from '../fcm/fcm.service';
import { StorageService } from './storage.service';

@Injectable()
export class MessagingService {
  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<Conversation>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    private fcmService: FcmService,
    private storageService: StorageService,
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

  async getConversationById(conversationId: string): Promise<Conversation> {
    const conv = await this.conversationModel.findById(conversationId);
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
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
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.blockedBy && conversation.blockedBy.length > 0) {
      throw new Error('Conversation is blocked');
    }

    const message = new this.messageModel({
      conversationId,
      senderId,
      content,
    });
    await message.save();

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

    // Do not send FCM here, it will be done in the gateway if the user is offline
    
    return message;
  }

  async sendImageMessage(conversationId: string, senderId: string, file: Express.Multer.File): Promise<Message> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.blockedBy && conversation.blockedBy.length > 0) {
      throw new Error('Conversation is blocked');
    }

    const imageUrl = await this.storageService.uploadImage(file);
    const message = new this.messageModel({
      conversationId,
      senderId,
      content: 'Image',
      imageUrl,
    });
    await message.save();

    conversation.lastMessage = message._id as Types.ObjectId;
    const newUnread = { ...conversation.unreadCounts };
    conversation.participants.forEach((p) => {
      if (p !== senderId) {
        newUnread[p] = (newUnread[p] || 0) + 1;
      }
    });
    conversation.unreadCounts = newUnread;
    await conversation.save();

    return message;
  }

  async blockConversation(conversationId: string, userId: string): Promise<Conversation> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');

    if (!conversation.blockedBy) {
      conversation.blockedBy = [];
    }
    if (!conversation.blockedBy.includes(userId)) {
      conversation.blockedBy.push(userId);
    }
    return conversation.save();
  }

  async deleteMessage(conversationId: string, messageId: string, userId: string): Promise<void> {
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Message not found');

    if (message.senderId !== userId) {
      throw new Error('You can only delete your own messages');
    }

    // Check if within 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (message.createdAt < fiveMinutesAgo) {
      throw new Error('Can only delete messages within 5 minutes of sending');
    }

    await this.messageModel.findByIdAndDelete(messageId);
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
