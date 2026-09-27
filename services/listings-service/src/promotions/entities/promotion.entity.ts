import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { Listing } from '../../listings/entities/listing.entity';

export enum PromotionPlan {
  BASIC = 'basic',
  FEATURED = 'featured',
  PREMIUM = 'premium',
}

export enum PromotionStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}

@Entity('promotions')
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'listing_id', unique: true })
  listingId: string;

  @OneToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing: Listing;

  @Column({ name: 'seller_id', type: 'uuid' })
  sellerId: string;

  @Column({ type: 'varchar' })
  plan: PromotionPlan;

  @Column({ name: 'price_paid', type: 'decimal', precision: 10, scale: 2 })
  pricePaid: number;

  @Column({ name: 'stripe_payment_intent_id', unique: true })
  stripePaymentIntentId: string;

  @Column({ name: 'stripe_payment_status', default: PromotionStatus.PENDING })
  stripePaymentStatus: PromotionStatus;

  @Column({ name: 'boost_multiplier', type: 'decimal', precision: 3, scale: 2 })
  boostMultiplier: number;

  @Column({ name: 'starts_at', type: 'timestamp with time zone', nullable: true })
  startsAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp with time zone', nullable: true })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
