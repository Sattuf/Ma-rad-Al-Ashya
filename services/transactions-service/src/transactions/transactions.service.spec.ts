import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Transaction, TransactionStatus } from './entities/transaction.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { HttpService } from '@nestjs/axios';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { of } from 'rxjs';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let txRepo: any;
  let notificationsMock: any;
  let httpMock: any;

  beforeEach(async () => {
    txRepo = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((dto) => ({ ...dto, id: 'tx-1' })),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    notificationsMock = {
      sendPushNotification: jest.fn(),
    };

    httpMock = {
      put: jest.fn().mockReturnValue(of({ data: {} })),
      post: jest.fn().mockReturnValue(of({ data: [{ id: 'l-1', userId: 's-1', status: 'active' }] })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: getRepositoryToken(Transaction), useValue: txRepo },
        { provide: NotificationsService, useValue: notificationsMock },
        { provide: HttpService, useValue: httpMock },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    // Mock Redis
    (service as any).redis = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn(),
    };
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw if buyer is seller', async () => {
      await expect(service.create('u-1', { listing_id: 'l-1', seller_id: 'u-1' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw if idempotency key exists', async () => {
      (service as any).redis.set.mockResolvedValueOnce(null);
      await expect(service.create('b-1', { listing_id: 'l-1', seller_id: 's-1' }))
        .rejects.toThrow(ConflictException);
    });

    it('should reject when seller does not own the listing', async () => {
      httpMock.post.mockReturnValueOnce(of({ data: [{ id: 'l-1', userId: 'someone-else', status: 'active' }] }));
      await expect(service.create('b-1', { listing_id: 'l-1', seller_id: 's-1' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should reject when listing is no longer active', async () => {
      httpMock.post.mockReturnValueOnce(of({ data: [{ id: 'l-1', userId: 's-1', status: 'sold' }] }));
      await expect(service.create('b-1', { listing_id: 'l-1', seller_id: 's-1' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should create transaction successfully', async () => {
      const res = await service.create('b-1', { listing_id: 'l-1', seller_id: 's-1' });
      expect(res.id).toBe('tx-1');
      expect(res.status).toBe(TransactionStatus.PENDING_SELLER);
      expect(notificationsMock.sendPushNotification).toHaveBeenCalled();
    });
  });

  describe('confirm', () => {
    it('should advance to pending_buyer when seller confirms', async () => {
      txRepo.findOne.mockResolvedValue({
        id: 'tx-1',
        seller_id: 's-1',
        buyer_id: 'b-1',
        status: TransactionStatus.PENDING_SELLER,
      });
      const res = await service.confirm('tx-1', 's-1');
      expect(res.status).toBe(TransactionStatus.PENDING_BUYER);
    });

    it('should complete when buyer confirms', async () => {
      txRepo.findOne.mockResolvedValue({
        id: 'tx-1',
        seller_id: 's-1',
        buyer_id: 'b-1',
        status: TransactionStatus.PENDING_BUYER,
        listing_id: 'l-1',
      });
      const res = await service.confirm('tx-1', 'b-1');
      expect(res.status).toBe(TransactionStatus.COMPLETED);
      expect(httpMock.put).toHaveBeenCalled();
    });
  });

  describe('sendFraudAnalysis', () => {
    const realFetch = global.fetch;
    const tx = { id: 'tx-9', listing_id: 'l-1', buyer_id: 'b-1', seller_id: 's-1' } as Transaction;
    afterEach(() => {
      global.fetch = realFetch;
    });

    it('sends the listing price, currency and category in the shape fraud-service expects', async () => {
      httpMock.post.mockReturnValue(of({ data: [{ id: 'l-1', price: '250.00', currency: 'USD', categoryId: 'cat-1' }] }));
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
      global.fetch = fetchMock as any;
      await service.sendFraudAnalysis(tx);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toMatch(/\/fraud\/transaction\/analyze$/);
      expect(JSON.parse(init.body)).toEqual({
        transaction_id: 'tx-9',
        user_id: 'b-1',
        amount: 250,
        currency: 'USD',
        merchant_category_code: 'cat-1',
        location_country: 'SY',
        timestamp: expect.any(String),
      });
    });

    it('skips without a price, logs refusals and network errors, never throws', async () => {
      const warn = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
      const error = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
      const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 422 });
      global.fetch = fetchMock as any;

      httpMock.post.mockReturnValue(of({ data: [null] }));
      await service.sendFraudAnalysis(tx);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith('Fraud analysis skipped: no price for listing l-1');

      httpMock.post.mockReturnValue(of({ data: [{ price: '10' }] }));
      await service.sendFraudAnalysis(tx);
      expect(warn).toHaveBeenCalledWith('Transaction fraud analysis refused: HTTP 422');

      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as any;
      await expect(service.sendFraudAnalysis(tx)).resolves.toBeUndefined();
      expect(error).toHaveBeenCalledWith('Failed to send transaction fraud analysis: ECONNREFUSED');
    });
  });
});
