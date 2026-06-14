import { ApiPropertyOptional } from '@nestjs/swagger';

export class SearchQueryDto {
  @ApiPropertyOptional()
  q?: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiPropertyOptional()
  minPrice?: number;

  @ApiPropertyOptional()
  maxPrice?: number;

  @ApiPropertyOptional()
  lat?: number;

  @ApiPropertyOptional()
  lon?: number;

  @ApiPropertyOptional()
  radius?: string;

  @ApiPropertyOptional({ enum: ['A', 'B'] })
  ab_variant?: 'A' | 'B';

  @ApiPropertyOptional()
  session_id?: string;
}
