import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Conversation } from '../schemas/conversation.schema';
import { MAX_MESSAGE_LENGTH, Message } from '../schemas/message.schema';
import { FcmService } from '../fcm/fcm.service';
import { StorageService } from './storage.service';

const MAX_PAGE_SIZE = 100;
// User ids are used as Mongo field names (unreadCounts.<id>), so '.' and '$' must never get through.
const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function clampLimit(limit: unknown, fallback = 50): number {
  const parsed = Number(limit);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), MAX_PAGE_SIZE) : fallback;
}

export function clampSkip(skip: unknown): number {
  const parsed = Number(skip);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

@Injectable()
export class MessagingService {
  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<Conversation>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    private fcmService: FcmService,
    private storageService: StorageService,
  ) {}

  /** A conversation is between the caller and exactly one other user. */
  async createOrGetConversation(userId: string, otherUserIds: unknown, listingId?: string): Promise<Conversation> {
    const others = Array.isArray(otherUserIds)
      ? otherUserIds.filter((p): p is string => typeof p === 'string' && USER_ID_PATTERN.test(p))
      : [];
    if (!USER_ID_PATTERN.test(userId)) {
      throw new BadRequestException('Invalid user id');
    }
    const participants = Array.from(new Set([userId, ...others]));
    if (participants.length !== 2) {
      throw new BadRequestException('A conversation needs exactly one other participant');
    }

    const existing = await this.conversationModel.findOne({
      participants: { $all: participants, $size: participants.length },
    });
    if (existing) return existing;

    const initialUnread: Record<string, number> = {};
    participants.forEach((p) => (initialUnread[p] = 0));

    const conversation = new this.conversationModel({
      participants,
      listingId: typeof listingId === 'string' ? listingId : undefined,
      unreadCounts: initialUnread,
    });
    return conversation.save();
  }

  async getConversations(userId: string, limit = 20, skip = 0): Promise<Conversation[]> {
    return this.conversationModel
      .find({ participants: userId })
      .populate('lastMessage')
      .sort({ updatedAt: -1 })
      .skip(clampSkip(skip))
      .limit(clampLimit(limit, 20))
      .exec();
  }

  async getConversationById(conversationId: string): Promise<Conversation> {
    if (!isValidObjectId(conversationId)) throw new NotFoundException('Conversation not found');
    const conv = await this.conversationModel.findById(conversationId);
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  /** Loads a conversation and ensures the user takes part in it. */
  async getConversationForParticipant(conversationId: string, userId: string): Promise<Conversation> {
    const conversation = await this.getConversationById(conversationId);
    if (!conversation.participants.includes(userId)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }
    return conversation;
  }

  async getMessages(conversationId: string, userId: string, limit = 50, skip = 0): Promise<Message[]> {
    await this.getConversationForParticipant(conversationId, userId);
    return this.messageModel
      .find({ conversationId })
      .sort({ createdAt: -1 })
      .skip(clampSkip(skip))
      .limit(clampLimit(limit))
      .exec();
  }

  async sendMessage(conversationId: string, senderId: string, content: unknown): Promise<Message> {
    if (typeof content !== 'string' || !content.trim()) {
      throw new BadRequestException('Message content is required');
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(`Message is longer than ${MAX_MESSAGE_LENGTH} characters`);
    }

    const conversation = await this.getConversationForParticipant(conversationId, senderId);
    this.assertNotBlocked(conversation);

    const message = new this.messageModel({ conversationId, senderId, content });
    await message.save();
    await this.recordNewMessage(conversation, message._id as Types.ObjectId, senderId);
    return message;
  }

  async sendImageMessage(conversationId: string, senderId: string, file: Express.Multer.File): Promise<Message> {
    if (!file) throw new BadRequestException('Image file is required');
    const conversation = await this.getConversationForParticipant(conversationId, senderId);
    this.assertNotBlocked(conversation);

    const imageUrl = await this.storageService.uploadImage(file);
    const message = new this.messageModel({
      conversationId,
      senderId,
      content: 'Image',
      imageUrl,
    });
    await message.save();
    await this.recordNewMessage(conversation, message._id as Types.ObjectId, senderId);
    return message;
  }

  async blockConversation(conversationId: string, userId: string): Promise<Conversation | null> {
    await this.getConversationForParticipant(conversationId, userId);
    return this.conversationModel.findByIdAndUpdate(
      conversationId,
      { $addToSet: { blockedBy: userId } },
      { new: true },
    );
  }

  async deleteMessage(conversationId: string, messageId: string, userId: string): Promise<void> {
    if (!isValidObjectId(messageId)) throw new NotFoundException('Message not found');
    const message = await this.messageModel.findById(messageId);
    if (!message || message.conversationId.toString() !== conversationId) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (message.createdAt < fiveMinutesAgo) {
      throw new BadRequestException('Can only delete messages within 5 minutes of sending');
    }

    await this.messageModel.findByIdAndDelete(messageId);
  }

  async markRead(conversationId: string, userId: string): Promise<void> {
    await this.getConversationForParticipant(conversationId, userId);
    await this.messageModel.updateMany(
      { conversationId, senderId: { $ne: userId }, isRead: false },
      { $set: { isRead: true } },
    );
    await this.conversationModel.updateOne(
      { _id: conversationId },
      { $set: { [`unreadCounts.${userId}`]: 0 } },
    );
  }

  private assertNotBlocked(conversation: Conversation): void {
    if (conversation.blockedBy && conversation.blockedBy.length > 0) {
      throw new ForbiddenException('Conversation is blocked');
    }
  }

  /** Single atomic update instead of read-modify-write (no lost unread counts under load). */
  private async recordNewMessage(conversation: Conversation, messageId: Types.ObjectId, senderId: string) {
    const increments: Record<string, number> = {};
    for (const participant of conversation.participants) {
      if (participant !== senderId) increments[`unreadCounts.${participant}`] = 1;
    }
    await this.conversationModel.updateOne(
      { _id: conversation._id },
      { $set: { lastMessage: messageId }, $inc: increments },
    );
  }
}
