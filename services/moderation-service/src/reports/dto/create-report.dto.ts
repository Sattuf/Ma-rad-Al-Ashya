import { IsString, IsUUID, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReportDto {
  @ApiProperty({ example: 'listing', enum: ['listing', 'user'] })
  @IsString()
  @IsIn(['listing', 'user'])
  target_type: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  target_id: string;

  @ApiProperty({ example: 'spam', enum: ['spam', 'fake', 'inappropriate', 'scam', 'offensive', 'wrong_category', 'other'] })
  @IsString()
  @IsIn(['spam', 'fake', 'inappropriate', 'scam', 'offensive', 'wrong_category', 'other'])
  reason: string;

  @ApiPropertyOptional({ example: 'Looks like a fake ad.' })
  @IsString()
  @IsOptional()
  description?: string;
}
