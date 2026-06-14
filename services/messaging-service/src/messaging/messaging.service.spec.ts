import { Test, TestingModule } from '@nestjs/testing';
import { MessagingService } from './messaging.service';
import { getModelToken } from '@nestjs/mongoose';
import { Conversation } from '../schemas/conversation.schema';
import { Message } from '../schemas/message.schema';
import { FcmService } from '../fcm/fcm.service';

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
    save = jest.fn().mockResolvedValue(this.data);
  }

  class MockMessageModelClass {
    constructor(public data: any) {
      Object.assign(this, data);
      this._id = 'mockMessageId';
    }
    save = jest.fn().mockResolvedValue(this);
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
          useValue: mockMessageModelClass, // Use class constructor mock for 'new model()'
        },
        {
          provide: FcmService,
          useValue: { sendNotification: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<MessagingService>(MessagingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
