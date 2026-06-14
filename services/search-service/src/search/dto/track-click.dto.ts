import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TrackClickDto {
  @ApiProperty()
  query: string;

  @ApiPropertyOptional()
  listing_id?: string;

  @ApiPropertyOptional()
  position?: number;

  @ApiProperty({ enum: ['A', 'B'] })
  variant: 'A' | 'B';

  @ApiProperty()
  session_id: string;
}
