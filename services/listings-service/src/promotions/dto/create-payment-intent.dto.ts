import { IsNotEmpty, IsUUID, IsEnum } from 'class-validator';
import { PromotionPlan } from '../entities/promotion.entity';

export class CreatePaymentIntentDto {
  @IsNotEmpty()
  @IsUUID()
  listingId: string;

  @IsNotEmpty()
  @IsEnum(PromotionPlan)
  plan: PromotionPlan;
}
