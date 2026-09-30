import { IsString, IsNumber, IsOptional, IsUUID, IsPositive, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListingCondition } from '../entities/listing.entity';

export class CreateListingDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ enum: ListingCondition })
  @IsEnum(ListingCondition)
  @IsOptional()
  condition?: ListingCondition;

  /** Trimmed by the service; an empty string or null clears it. */
  @ApiPropertyOptional({ maxLength: 100, example: 'دمشق - المزة' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  location?: string | null;
}
