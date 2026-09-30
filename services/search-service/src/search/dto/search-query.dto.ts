import { ApiPropertyOptional } from '@nestjs/swagger';

/** Query params are strings on the wire; the service validates and clamps each one. */
export class SearchQueryDto {
  @ApiPropertyOptional({ description: 'Search text (max 100 chars)' })
  q?: string;

  @ApiPropertyOptional({ description: 'Category id; a parent includes its subcategories' })
  categoryId?: string;

  @ApiPropertyOptional({ enum: ['new', 'used'] })
  condition?: string;

  @ApiPropertyOptional()
  minPrice?: number;

  @ApiPropertyOptional()
  maxPrice?: number;

  @ApiPropertyOptional({ default: 1 })
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  limit?: number;

  @ApiPropertyOptional({ description: 'Anonymous visitor id for sticky A/B assignment' })
  session_id?: string;
}
