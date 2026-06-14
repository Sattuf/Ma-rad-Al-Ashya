import { ApiProperty } from '@nestjs/swagger';

export class SuggestionsSearchDto {
  @ApiProperty({ description: 'Search query string' })
  q: string;
}
