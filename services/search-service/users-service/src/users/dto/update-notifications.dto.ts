import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationsDto {
  @IsBoolean()
  @IsOptional()
  notification_messages?: boolean;

  @IsBoolean()
  @IsOptional()
  notification_listings?: boolean;

  @IsBoolean()
  @IsOptional()
  notification_transactions?: boolean;
}
