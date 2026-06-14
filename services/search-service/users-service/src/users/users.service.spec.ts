import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { StorageService } from '../storage/storage.service';
import { NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let mockUsersRepository: any;
  let mockStorageService: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    full_name: 'Test User',
    notification_messages: true,
  };

  beforeEach(async () => {
    mockUsersRepository = {
      findOne: jest.fn().mockResolvedValue(mockUser),
      save: jest.fn().mockImplementation((user) => Promise.resolve(user)),
    };

    mockStorageService = {
      uploadAvatar: jest.fn().mockResolvedValue('http://example.com/avatar.jpg'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUsersRepository,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get profile', async () => {
    const result = await service.getProfile('user-1');
    expect(result).toEqual(mockUser);
    expect(mockUsersRepository.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
  });

  it('should update profile', async () => {
    const dto = { full_name: 'New Name' };
    const result = await service.updateProfile('user-1', dto);
    expect(result.full_name).toEqual('New Name');
    expect(mockUsersRepository.save).toHaveBeenCalled();
  });

  it('should throw NotFoundException if user not found', async () => {
    mockUsersRepository.findOne.mockResolvedValueOnce(null);
    await expect(service.getProfile('unknown-id')).rejects.toThrow(NotFoundException);
  });
});
