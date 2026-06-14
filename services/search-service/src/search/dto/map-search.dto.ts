import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MapSearchDto {
  @ApiProperty({ description: 'Top left latitude', type: Number })
  topLeftLat: number;

  @ApiProperty({ description: 'Top left longitude', type: Number })
  topLeftLon: number;

  @ApiProperty({ description: 'Bottom right latitude', type: Number })
  bottomRightLat: number;

  @ApiProperty({ description: 'Bottom right longitude', type: Number })
  bottomRightLon: number;

  @ApiPropertyOptional({ description: 'Map zoom level', type: Number })
  zoom?: number;
}
