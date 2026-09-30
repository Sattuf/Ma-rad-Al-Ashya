import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ListingsService } from './listings.service';
import { Listing, ListingCondition, ListingStatus } from './entities/listing.entity';
import { ListingImage } from './entities/listing-image.entity';
import { StorageService } from '../storage/storage.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';

const mockRedis = {
  incr: jest.fn(),
  keys: jest.fn().mockResolvedValue([]),
  get: jest.fn(),
  set: jest.fn(),
  scan: jest.fn(),
  getdel: jest.fn(),
};

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockRedis),
}));

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

  const mockHttpService = {
    get: jest.fn().mockReturnValue(of({ data: {} })),
    post: jest.fn().mockReturnValue(of({ data: {} })),
  };

  const queryBuilder = () => {
    const qb: any = {};
    for (const m of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy', 'addOrderBy', 'skip', 'take']) {
      qb[m] = jest.fn().mockReturnValue(qb);
    }
    qb.getManyAndCount = jest.fn().mockResolvedValue([[{ id: 'l-1' }], 120]);
    return qb;
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
        {
          provide: HttpService,
          useValue: mockHttpService,
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
        location: null,
        userId,
        status: ListingStatus.ACTIVE,
      });
      expect(mockListingRepository.save).toHaveBeenCalledWith(savedListing);
    });

    it('stores condition and a tidied location; a blank location is "not specified"', async () => {
      mockListingRepository.create.mockImplementation((v) => v);
      mockListingRepository.save.mockImplementation(async (v) => v);

      const withBoth = await service.create('user-1', {
        title: 'T', description: 'D', price: 5, condition: ListingCondition.USED, location: '  دمشق   -  المزة ',
      });
      expect(withBoth).toMatchObject({ condition: 'used', location: 'دمشق - المزة' });

      const blank = await service.create('user-1', { title: 'T', description: 'D', price: 5, location: '   ' });
      expect(blank.location).toBeNull();
    });
  });

  describe('update', () => {
    it('clears the location with an empty string and leaves it alone when absent', async () => {
      const listing = { id: 'l1', userId: 'u1', status: ListingStatus.ACTIVE, location: 'حلب', condition: 'new' };
      mockListingRepository.findOne.mockResolvedValue({ ...listing });
      mockListingRepository.save.mockImplementation(async (v) => v);

      expect((await service.update('l1', 'u1', { title: 'x' })).location).toBe('حلب');
      mockListingRepository.findOne.mockResolvedValue({ ...listing });
      expect((await service.update('l1', 'u1', { location: '' })).location).toBeNull();
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

  describe('findAll', () => {
    it('caps page size at 50 and only returns active listings by default', async () => {
      const qb = queryBuilder();
      mockListingRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ limit: '10000', page: '3' });

      expect(qb.take).toHaveBeenCalledWith(50);
      expect(qb.skip).toHaveBeenCalledWith(100);
      expect(qb.where).toHaveBeenCalledWith('listing.status = :status', { status: ListingStatus.ACTIVE });
      expect(result.meta).toEqual({ total: 120, page: 3, limit: 50, lastPage: 3 });
    });

    it('never exposes deleted listings even when asked', async () => {
      const qb = queryBuilder();
      mockListingRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ status: ListingStatus.DELETED });

      expect(qb.where).toHaveBeenCalledWith('listing.status = :status', { status: ListingStatus.ACTIVE });
    });

    it('treats LIKE wildcards in the search term literally', async () => {
      const qb = queryBuilder();
      mockListingRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ search: '100%_off' });

      expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), { search: '%100\\%\\_off%' });
    });

    it('filters by a bounded list of valid ids and drops malformed ones', async () => {
      const qb = queryBuilder();
      mockListingRepository.createQueryBuilder.mockReturnValue(qb);
      const id = '3f2b8c1e-8a1d-4c55-9a7e-0b6f1f0e2d11';

      await service.findAll({ ids: `${id},not-a-uuid,${id}` });

      expect(qb.andWhere).toHaveBeenCalledWith('listing.id IN (:...ids)', { ids: [id] });
      // Deal history needs sold/expired listings too, never deleted ones.
      expect(qb.where).toHaveBeenCalledWith('listing.status IN (:...statuses)', { statuses: expect.not.arrayContaining([ListingStatus.DELETED]) });
    });

    it('returns nothing (not everything) when ids are all invalid', async () => {
      const qb = queryBuilder();
      mockListingRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ ids: "1' OR '1'='1" });

      expect(qb.andWhere).toHaveBeenCalledWith('1 = 0', { ids: [] });
    });

    it('includes subcategories when filtering by a parent category', async () => {
      const qb = queryBuilder();
      mockListingRepository.createQueryBuilder.mockReturnValue(qb);
      const categoryId = '3f2b8c1e-8a1d-4c55-9a7e-0b6f1f0e2d11';

      await service.findAll({ categoryId });

      expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('c.parent_id = :categoryId'), { categoryId });
    });

    it('filters by condition, and ignores values outside new/used', async () => {
      const qb = queryBuilder();
      mockListingRepository.createQueryBuilder.mockReturnValue(qb);
      await service.findAll({ condition: 'new' });
      expect(qb.andWhere).toHaveBeenCalledWith('listing.condition = :condition', { condition: 'new' });

      const qb2 = queryBuilder();
      mockListingRepository.createQueryBuilder.mockReturnValue(qb2);
      await service.findAll({ condition: "new' OR 1=1" });
      expect(qb2.andWhere).not.toHaveBeenCalled();
    });

    it('ignores non-uuid category and user filters instead of failing in Postgres', async () => {
      const qb = queryBuilder();
      mockListingRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ categoryId: 'abc', userId: '../x' });

      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('deleted listings', () => {
    it('are not found through the public lookup', async () => {
      mockListingRepository.findOne.mockResolvedValue({ id: 'l-1', status: ListingStatus.DELETED });
      await expect(service.findOne('l-1')).rejects.toThrow(NotFoundException);
    });

    it('cannot be re-activated by their owner', async () => {
      mockListingRepository.findOne.mockResolvedValue({ id: 'l-1', userId: 'user-1', status: ListingStatus.DELETED });
      await expect(service.updateStatus('l-1', 'user-1', ListingStatus.ACTIVE)).rejects.toThrow(NotFoundException);
    });

    it('owners cannot set arbitrary statuses', async () => {
      await expect(service.updateStatus('l-1', 'user-1', 'hacked' as ListingStatus)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateStatus('l-1', 'user-1', ListingStatus.EXPIRED)).rejects.toThrow(BadRequestException);
    });
  });

  describe('syncViews', () => {
    it('uses SCAN + GETDEL instead of KEYS and flushes counts to Postgres', async () => {
      (mockListingRepository as any).increment = jest.fn();
      mockRedis.scan
        .mockResolvedValueOnce(['7', ['listing:views:a']])
        .mockResolvedValueOnce(['0', ['listing:views:b']]);
      mockRedis.getdel.mockResolvedValueOnce('3').mockResolvedValueOnce(null);

      await service.syncViews();

      expect(mockRedis.keys).not.toHaveBeenCalled();
      expect((mockListingRepository as any).increment).toHaveBeenCalledTimes(1);
      expect((mockListingRepository as any).increment).toHaveBeenCalledWith({ id: 'a' }, 'viewsCount', 3);
    });
  });
});
