import { Test, TestingModule } from '@nestjs/testing';
import { MessagingService } from './messaging.service';
import { getModelToken } from '@nestjs/mongoose';
import { Conversation } from '../schemas/conversation.schema';
import { Message } from '../schemas/message.schema';
import { FcmService } from '../fcm/fcm.service';
import { StorageService } from './storage.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('MessagingService', () => {
  let service: MessagingService;

  const mockConversationModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    exec: jest.fn(),
    save: jest.fn(),
  };

  const mockMessageModel = {
    find: jest.fn(),
    updateMany: jest.fn(),
    exec: jest.fn(),
    save: jest.fn(),
  };

  class MockConversationModelClass {
    constructor(public data: any) {}
    save() { return Promise.resolve(this.data); }
  }

  class MockMessageModelClass {
    _id: string;
    constructor(public data: any) {
      Object.assign(this, data);
      this._id = 'mockMessageId';
    }
    save() { return Promise.resolve(this); }
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingService,
        {
          provide: getModelToken(Conversation.name),
          useValue: mockConversationModel,
        },
        {
          provide: getModelToken(Message.name),
          useValue: MockMessageModelClass, // Use class constructor mock for 'new model()'
        },
        {
          provide: FcmService,
          useValue: { sendNotification: jest.fn() },
        },
        {
          provide: StorageService,
          useValue: { uploadImage: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<MessagingService>(MessagingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('authorization', () => {
    const conversationId = '64b7f0c2a1b2c3d4e5f60718';
    const conversation = { _id: conversationId, participants: ['alice', 'bob'], blockedBy: [] };

    beforeEach(() => {
      mockConversationModel.findById.mockResolvedValue(conversation);
    });

    it('rejects reading messages of a conversation the user is not part of', async () => {
      await expect(service.getMessages(conversationId, 'mallory')).rejects.toThrow(ForbiddenException);
    });

    it('rejects sending into a conversation the user is not part of', async () => {
      await expect(service.sendMessage(conversationId, 'mallory', 'hi')).rejects.toThrow(ForbiddenException);
    });

    it('rejects marking as read for non participants', async () => {
      await expect(service.markRead(conversationId, 'mallory')).rejects.toThrow(ForbiddenException);
    });

    it('rejects oversized messages', async () => {
      await expect(service.sendMessage(conversationId, 'alice', 'x'.repeat(2001))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('treats malformed conversation ids as not found', async () => {
      await expect(service.getMessages('not-an-id', 'alice')).rejects.toThrow(NotFoundException);
    });

    it('refuses participant ids that could inject Mongo operators', async () => {
      await expect(service.createOrGetConversation('alice', ['$where'])).rejects.toThrow(BadRequestException);
      await expect(service.createOrGetConversation('alice', ['a.b'])).rejects.toThrow(BadRequestException);
    });

    it('always includes the caller and exactly one other participant', async () => {
      await expect(service.createOrGetConversation('alice', ['bob', 'carol'])).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createOrGetConversation('alice', ['alice'])).rejects.toThrow(BadRequestException);
    });
  });
});
