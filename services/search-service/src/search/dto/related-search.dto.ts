import { ApiProperty } from '@nestjs/swagger';

export class RelatedSearchDto {
  @ApiProperty({ description: 'Original listing ID' })
  id: string;
}
