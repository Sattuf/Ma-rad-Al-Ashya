import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import Stripe = require('stripe');
import { Listing, ListingStatus } from '../listings/entities/listing.entity';
import { Promotion, PromotionPlan, PromotionStatus } from './entities/promotion.entity';

export const PROMOTION_PLANS = {
  [PromotionPlan.BASIC]: {
    id: PromotionPlan.BASIC,
    name: 'Basic Boost',
    price: 9.99,
    boostMultiplier: 1.5,
    durationDays: 7,
  },
  [PromotionPlan.FEATURED]: {
    id: PromotionPlan.FEATURED,
    name: 'Featured Boost',
    price: 24.99,
    boostMultiplier: 2.5,
    durationDays: 14,
  },
  [PromotionPlan.PREMIUM]: {
    id: PromotionPlan.PREMIUM,
    name: 'Premium Boost',
    price: 49.99,
    boostMultiplier: 4.0,
    durationDays: 30,
  },
};

@Injectable()
export class PromotionsService {
  private stripe: any;
  private readonly logger = new Logger(PromotionsService.name);

  constructor(
    @InjectRepository(Promotion)
    private promotionsRepository: Repository<Promotion>,
    @InjectRepository(Listing)
    private listingsRepository: Repository<Listing>,
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY') || 'sk_test_mock';
    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16' as any,
    });
  }

  async getPlans() {
    return [
      {
        id: PromotionPlan.BASIC,
        price: PROMOTION_PLANS[PromotionPlan.BASIC].price,
        boost_multiplier: PROMOTION_PLANS[PromotionPlan.BASIC].boostMultiplier,
        duration_days: PROMOTION_PLANS[PromotionPlan.BASIC].durationDays,
      },
      {
        id: PromotionPlan.FEATURED,
        price: PROMOTION_PLANS[PromotionPlan.FEATURED].price,
        boost_multiplier: PROMOTION_PLANS[PromotionPlan.FEATURED].boostMultiplier,
        duration_days: PROMOTION_PLANS[PromotionPlan.FEATURED].durationDays,
      },
      {
        id: PromotionPlan.PREMIUM,
        price: PROMOTION_PLANS[PromotionPlan.PREMIUM].price,
        boost_multiplier: PROMOTION_PLANS[PromotionPlan.PREMIUM].boostMultiplier,
        duration_days: PROMOTION_PLANS[PromotionPlan.PREMIUM].durationDays,
      },
    ];
  }

  async createPaymentIntent(userId: string, listingId: string, plan: PromotionPlan) {
    const listing = await this.listingsRepository.findOne({ where: { id: listingId } });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.userId !== userId) {
      throw new BadRequestException('Not authorized: Only the seller can promote this listing');
    }
    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('Only active listings can be promoted');
    }

    const existing = await this.promotionsRepository.findOne({ where: { listingId } });
    if (existing) {
      if (existing.stripePaymentStatus === PromotionStatus.SUCCEEDED) {
        const now = new Date();
        if (existing.expiresAt && existing.expiresAt > now) {
          throw new BadRequestException('Listing is already promoted');
        }
      }
      await this.promotionsRepository.remove(existing);
    }

    const planConfig = PROMOTION_PLANS[plan];
    if (!planConfig) {
      throw new BadRequestException('Invalid promotion plan');
    }

    const amountInCents = Math.round(planConfig.price * 100);
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      metadata: {
        listingId,
        sellerId: userId,
        plan,
      },
    });

    const promotion = this.promotionsRepository.create({
      listingId,
      sellerId: userId,
      plan,
      pricePaid: planConfig.price,
      stripePaymentIntentId: paymentIntent.id,
      stripePaymentStatus: PromotionStatus.PENDING,
      boostMultiplier: planConfig.boostMultiplier,
    });

    await this.promotionsRepository.save(promotion);

    return {
      client_secret: paymentIntent.client_secret,
    };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET is not configured');
      throw new BadRequestException('Webhook secret is not configured');
    }

    let event: any;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    const paymentIntent = event.data.object as any;

    if (event.type === 'payment_intent.succeeded') {
      const promotion = await this.promotionsRepository.findOne({
        where: { stripePaymentIntentId: paymentIntent.id },
      });
      if (!promotion) {
        this.logger.warn(`Promotion not found for payment intent ${paymentIntent.id}`);
        return { received: true };
      }

      promotion.stripePaymentStatus = PromotionStatus.SUCCEEDED;
      const startsAt = new Date();
      const planConfig = PROMOTION_PLANS[promotion.plan];
      const durationDays = planConfig ? planConfig.durationDays : 7;
      const expiresAt = new Date(startsAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

      promotion.startsAt = startsAt;
      promotion.expiresAt = expiresAt;

      await this.promotionsRepository.save(promotion);

      try {
        const searchServiceUrl = this.configService.get<string>('SEARCH_SERVICE_URL') || 'http://localhost:3003';
        const secret = this.configService.get<string>('INTERNAL_SECRET') || 'marad-internal-secret-for-webhooks';
        
        await firstValueFrom(
          this.httpService.put(
            `${searchServiceUrl}/search/listings/${promotion.listingId}/boost`,
            {
              boost_multiplier: Number(promotion.boostMultiplier),
              expires_at: expiresAt.toISOString(),
            },
            {
              headers: { 'x-internal-secret': secret },
            }
          )
        );
        this.logger.log(`Successfully triggered boost in search-service for listing ${promotion.listingId}`);
      } catch (err) {
        this.logger.error(
          `Failed to update boost in search-service for listing ${promotion.listingId}: ${err.message}`
        );
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      const promotion = await this.promotionsRepository.findOne({
        where: { stripePaymentIntentId: paymentIntent.id },
      });
      if (promotion) {
        promotion.stripePaymentStatus = PromotionStatus.FAILED;
        await this.promotionsRepository.save(promotion);
      }
    }

    return { received: true };
  }

  async getMyPromotions(sellerId: string) {
    return this.promotionsRepository.find({
      where: { sellerId },
      relations: { listing: true },
    });
  }
}
