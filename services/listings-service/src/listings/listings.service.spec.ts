import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ListingsService } from './listings.service';
import { Listing, ListingStatus } from './entities/listing.entity';
import { ListingImage } from './entities/listing-image.entity';
import { StorageService } from '../storage/storage.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    incr: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
    get: jest.fn(),
    set: jest.fn(),
  }));
});

describe('ListingsService', () => {
  let service: ListingsService;

  const mockListingRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockListingImagesRepository = {
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockStorageService = {
    uploadListingImage: jest.fn(),
  };

  beforeEach(async () => {

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        {
          provide: getRepositoryToken(Listing),
          useValue: mockListingRepository,
        },
        {
          provide: getRepositoryToken(ListingImage),
          useValue: mockListingImagesRepository,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
      ],
    }).compile();

    service = module.get<ListingsService>(ListingsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should successfully create a listing', async () => {
      const createDto = { title: 'Test Listing', description: 'Desc', price: 100 };
      const userId = 'user-1';
      const savedListing = { id: 'listing-1', ...createDto, userId, status: ListingStatus.ACTIVE };

      mockListingRepository.create.mockReturnValue(savedListing);
      mockListingRepository.save.mockResolvedValue(savedListing);

      const result = await service.create(userId, createDto);

      expect(result).toEqual(savedListing);
      expect(mockListingRepository.create).toHaveBeenCalledWith({
        ...createDto,
        userId,
        status: ListingStatus.ACTIVE,
      });
      expect(mockListingRepository.save).toHaveBeenCalledWith(savedListing);
    });
  });

  describe('findOne', () => {
    it('should return a listing if it exists', async () => {
      const listing = { id: 'listing-1', title: 'Test' };
      mockListingRepository.findOne.mockResolvedValue(listing);

      const result = await service.findOne('listing-1');
      expect(result).toEqual(listing);
    });

    it('should throw NotFoundException if listing does not exist', async () => {
      mockListingRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update listing status if user is authorized', async () => {
      const listing = { id: 'listing-1', userId: 'user-1', status: ListingStatus.ACTIVE };
      mockListingRepository.findOne.mockResolvedValue(listing);
      mockListingRepository.save.mockResolvedValue({ ...listing, status: ListingStatus.SOLD });

      const result = await service.updateStatus('listing-1', 'user-1', ListingStatus.SOLD);

      expect(result.status).toBe(ListingStatus.SOLD);
      expect(mockListingRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if user is not authorized', async () => {
      const listing = { id: 'listing-1', userId: 'user-2', status: ListingStatus.ACTIVE };
      mockListingRepository.findOne.mockResolvedValue(listing);

      await expect(service.updateStatus('listing-1', 'user-1', ListingStatus.SOLD)).rejects.toThrow(BadRequestException);
    });
  });
});
