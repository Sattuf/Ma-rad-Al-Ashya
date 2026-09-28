import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Review } from './entities/review.entity';
import { UserRatingSummary } from './entities/user-rating-summary.entity';
import { Transaction, TransactionStatus } from '../transactions/entities/transaction.entity';
import { DataSource } from 'typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let txRepo: any;
  let reviewRepo: any;
  let summaryRepo: any;
  let dataSourceMock: any;

  beforeEach(async () => {
    txRepo = { findOne: jest.fn() };
    reviewRepo = { findOne: jest.fn(), find: jest.fn() };
    summaryRepo = { findOne: jest.fn() };
    
    dataSourceMock = {
      createQueryRunner: jest.fn().mockReturnValue({
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          create: jest.fn().mockImplementation((entity, dto) => dto),
          save: jest.fn().mockImplementation((dto) => ({ ...dto, id: 'r-1' })),
          findOne: jest.fn(),
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: getRepositoryToken(Review), useValue: reviewRepo },
        { provide: getRepositoryToken(UserRatingSummary), useValue: summaryRepo },
        { provide: getRepositoryToken(Transaction), useValue: txRepo },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  it('should throw if transaction not completed', async () => {
    txRepo.findOne.mockResolvedValue({ status: TransactionStatus.PENDING_BUYER });
    await expect(service.create('tx-1', 'u-1', { rating: 5 }))
      .rejects.toThrow(BadRequestException);
  });

  it('should throw if review exists', async () => {
    txRepo.findOne.mockResolvedValue({ status: TransactionStatus.COMPLETED, buyer_id: 'u-1' });
    reviewRepo.findOne.mockResolvedValue({ id: 'r-1' });
    await expect(service.create('tx-1', 'u-1', { rating: 5 }))
      .rejects.toThrow(ConflictException);
  });

  it('should create review successfully', async () => {
    txRepo.findOne.mockResolvedValue({
      status: TransactionStatus.COMPLETED,
      buyer_id: 'u-1',
      seller_id: 'u-2',
      listing_id: 'l-1',
    });
    reviewRepo.findOne.mockResolvedValue(null);
    const qr = dataSourceMock.createQueryRunner();
    qr.manager.findOne.mockResolvedValue({
      user_id: 'u-2',
      total_reviews: 0,
      rating_5_count: 0,
    });

    const res = await service.create('tx-1', 'u-1', { rating: 5 });
    expect(res.id).toBe('r-1');
    expect(qr.commitTransaction).toHaveBeenCalled();
  });

  describe('rating summary', () => {
    const completedDeal = { status: TransactionStatus.COMPLETED, buyer_id: 'u-1', seller_id: 'u-2', listing_id: 'l-1' };
    const savedSummary = (qr: any) => qr.manager.save.mock.calls.map((c: any[]) => c[0]).find((e: any) => 'total_reviews' in e);

    it("creates a user's first summary with real numbers (was NaN → 500)", async () => {
      txRepo.findOne.mockResolvedValue(completedDeal);
      reviewRepo.findOne.mockResolvedValue(null);
      const qr = dataSourceMock.createQueryRunner();
      qr.manager.findOne.mockResolvedValue(null);

      await service.create('tx-1', 'u-1', { rating: 4 });

      expect(savedSummary(qr)).toMatchObject({ user_id: 'u-2', total_reviews: 1, rating_4_count: 1, rating_5_count: 0, average_rating: 4 });
    });

    it('updates an existing summary whose numbers come back from Postgres as strings', async () => {
      txRepo.findOne.mockResolvedValue(completedDeal);
      reviewRepo.findOne.mockResolvedValue(null);
      const qr = dataSourceMock.createQueryRunner();
      qr.manager.findOne.mockResolvedValue({
        user_id: 'u-2', total_reviews: 1, average_rating: '5.00',
        rating_1_count: 0, rating_2_count: 0, rating_3_count: 0, rating_4_count: 0, rating_5_count: 1,
      });

      await service.create('tx-1', 'u-1', { rating: 3 });

      expect(savedSummary(qr)).toMatchObject({ total_reviews: 2, rating_3_count: 1, average_rating: 4 });
    });
  });
});
