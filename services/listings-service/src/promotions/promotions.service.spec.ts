import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { of } from 'rxjs';
import { PromotionsService, PROMOTION_PLANS } from './promotions.service';
import { Promotion, PromotionPlan, PromotionStatus } from './entities/promotion.entity';
import { Listing, ListingStatus } from '../listings/entities/listing.entity';

const mockStripePaymentIntentsCreate = jest.fn();
const mockStripeConstructEvent = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: mockStripePaymentIntentsCreate,
    },
    webhooks: {
      constructEvent: mockStripeConstructEvent,
    },
  }));
});

describe('PromotionsService', () => {
  let service: PromotionsService;

  const mockPromotionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    find: jest.fn(),
  };

  const mockListingRepository = {
    findOne: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock';
      if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_mock';
      if (key === 'SEARCH_SERVICE_URL') return 'http://search-service';
      if (key === 'INTERNAL_SECRET') return 'secret';
      return null;
    }),
  };

  const mockHttpService = {
    put: jest.fn().mockReturnValue(of({ data: {} })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionsService,
        {
          provide: getRepositoryToken(Promotion),
          useValue: mockPromotionRepository,
        },
        {
          provide: getRepositoryToken(Listing),
          useValue: mockListingRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<PromotionsService>(PromotionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPlans', () => {
    it('should return all 3 promotion plans', async () => {
      const plans = await service.getPlans();
      expect(plans).toHaveLength(3);
      expect(plans[0].id).toBe(PromotionPlan.BASIC);
      expect(plans[1].id).toBe(PromotionPlan.FEATURED);
      expect(plans[2].id).toBe(PromotionPlan.PREMIUM);
    });
  });

  describe('createPaymentIntent', () => {
    it('should throw NotFoundException if listing is not found', async () => {
      mockListingRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createPaymentIntent('user-1', 'listing-1', PromotionPlan.BASIC)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user is not the listing owner', async () => {
      const listing = { id: 'listing-1', userId: 'user-2', status: ListingStatus.ACTIVE };
      mockListingRepository.findOne.mockResolvedValue(listing);

      await expect(
        service.createPaymentIntent('user-1', 'listing-1', PromotionPlan.BASIC)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if listing is not active', async () => {
      const listing = { id: 'listing-1', userId: 'user-1', status: ListingStatus.SOLD };
      mockListingRepository.findOne.mockResolvedValue(listing);

      await expect(
        service.createPaymentIntent('user-1', 'listing-1', PromotionPlan.BASIC)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if listing is already promoted with active promotion', async () => {
      const listing = { id: 'listing-1', userId: 'user-1', status: ListingStatus.ACTIVE };
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 5); // 5 days in future
      const activePromotion = {
        id: 'promo-1',
        listingId: 'listing-1',
        stripePaymentStatus: PromotionStatus.SUCCEEDED,
        expiresAt,
      };

      mockListingRepository.findOne.mockResolvedValue(listing);
      mockPromotionRepository.findOne.mockResolvedValue(activePromotion);

      await expect(
        service.createPaymentIntent('user-1', 'listing-1', PromotionPlan.BASIC)
      ).rejects.toThrow(BadRequestException);
    });

    it('should create payment intent and save pending promotion', async () => {
      const listing = { id: 'listing-1', userId: 'user-1', status: ListingStatus.ACTIVE };
      mockListingRepository.findOne.mockResolvedValue(listing);
      mockPromotionRepository.findOne.mockResolvedValue(null);

      const mockIntent = { id: 'pi_mock', client_secret: 'secret_mock' };
      mockStripePaymentIntentsCreate.mockResolvedValue(mockIntent);

      const mockPromo = { id: 'promo-1', listingId: 'listing-1' };
      mockPromotionRepository.create.mockReturnValue(mockPromo);
      mockPromotionRepository.save.mockResolvedValue(mockPromo);

      const result = await service.createPaymentIntent('user-1', 'listing-1', PromotionPlan.BASIC);

      expect(result).toEqual({ client_secret: 'secret_mock' });
      expect(mockStripePaymentIntentsCreate).toHaveBeenCalled();
      expect(mockPromotionRepository.create).toHaveBeenCalled();
      expect(mockPromotionRepository.save).toHaveBeenCalled();
    });

    it('should remove expired/failed/pending promotion before creating new intent', async () => {
      const listing = { id: 'listing-1', userId: 'user-1', status: ListingStatus.ACTIVE };
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 2); // expired 2 days ago
      const oldPromotion = {
        id: 'promo-1',
        listingId: 'listing-1',
        stripePaymentStatus: PromotionStatus.SUCCEEDED,
        expiresAt,
      };

      mockListingRepository.findOne.mockResolvedValue(listing);
      mockPromotionRepository.findOne.mockResolvedValue(oldPromotion);

      const mockIntent = { id: 'pi_mock', client_secret: 'secret_mock' };
      mockStripePaymentIntentsCreate.mockResolvedValue(mockIntent);

      const mockPromo = { id: 'promo-2', listingId: 'listing-1' };
      mockPromotionRepository.create.mockReturnValue(mockPromo);

      await service.createPaymentIntent('user-1', 'listing-1', PromotionPlan.BASIC);

      expect(mockPromotionRepository.remove).toHaveBeenCalledWith(oldPromotion);
    });
  });

  describe('handleWebhook', () => {
    it('should verify signature and throw if verification fails', async () => {
      mockStripeConstructEvent.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(
        service.handleWebhook(Buffer.from('{}'), 'invalid-sig')
      ).rejects.toThrow(BadRequestException);
    });

    it('should update status to succeeded, set times, and call search-service on payment_intent.succeeded', async () => {
      const event = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_mock',
          },
        },
      };
      mockStripeConstructEvent.mockReturnValue(event);

      const promotion: any = {
        id: 'promo-1',
        listingId: 'listing-1',
        plan: PromotionPlan.BASIC,
        boostMultiplier: 1.5,
        stripePaymentStatus: PromotionStatus.PENDING,
      };
      mockPromotionRepository.findOne.mockResolvedValue(promotion);
      mockPromotionRepository.save.mockResolvedValue(promotion);

      const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(result).toEqual({ received: true });
      expect(mockPromotionRepository.save).toHaveBeenCalled();
      expect(promotion.stripePaymentStatus).toBe(PromotionStatus.SUCCEEDED);
      expect(promotion.startsAt).toBeDefined();
      expect(promotion.expiresAt).toBeDefined();
      expect(mockHttpService.put).toHaveBeenCalled();
    });

    it('should update status to failed on payment_intent.payment_failed', async () => {
      const event = {
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_mock',
          },
        },
      };
      mockStripeConstructEvent.mockReturnValue(event);

      const promotion: any = {
        id: 'promo-1',
        listingId: 'listing-1',
        plan: PromotionPlan.BASIC,
        boostMultiplier: 1.5,
        stripePaymentStatus: PromotionStatus.PENDING,
      };
      mockPromotionRepository.findOne.mockResolvedValue(promotion);
      mockPromotionRepository.save.mockResolvedValue(promotion);

      const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(result).toEqual({ received: true });
      expect(mockPromotionRepository.save).toHaveBeenCalled();
      expect(promotion.stripePaymentStatus).toBe(PromotionStatus.FAILED);
    });
  });

  describe('getMyPromotions', () => {
    it('should return current seller\'s promotions', async () => {
      const mockPromotions = [{ id: 'promo-1', sellerId: 'user-1' }];
      mockPromotionRepository.find.mockResolvedValue(mockPromotions);

      const result = await service.getMyPromotions('user-1');
      expect(result).toEqual(mockPromotions);
      expect(mockPromotionRepository.find).toHaveBeenCalledWith({
        where: { sellerId: 'user-1' },
        relations: { listing: true },
      });
    });
  });
});
