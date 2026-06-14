import { Controller, Get, Post, Body, Query, Headers, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { SearchService } from './search.service';
import { ApiTags, ApiOperation, ApiQuery, ApiHeader } from '@nestjs/swagger';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search listings' })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'lat', required: false, type: Number })
  @ApiQuery({ name: 'lon', required: false, type: Number })
  @ApiQuery({ name: 'radius', required: false, type: String })
  async search(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('lat') lat?: string,
    @Query('lon') lon?: string,
    @Query('radius') radius?: string,
  ) {
    return this.searchService.search(
      q,
      category,
      minPrice ? parseFloat(minPrice) : undefined,
      maxPrice ? parseFloat(maxPrice) : undefined,
      lat ? parseFloat(lat) : undefined,
      lon ? parseFloat(lon) : undefined,
      radius
    );
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Autocomplete suggestions' })
  @ApiQuery({ name: 'q', required: true, type: String })
  async autocomplete(@Query('q') q: string) {
    if (!q) {
      throw new HttpException('Query is required', HttpStatus.BAD_REQUEST);
    }
    return this.searchService.autocomplete(q);
  }

  @Post('index')
  @ApiOperation({ summary: 'Webhook to index listing modifications' })
  @ApiHeader({ name: 'x-internal-secret', required: true })
  async indexListing(
    @Headers('x-internal-secret') secret: string,
    @Body() body: { action: 'create' | 'update' | 'delete', listing: any }
  ) {
    if (secret !== (process.env.INTERNAL_SECRET || 'secret123')) {
      throw new UnauthorizedException('Invalid internal secret');
    }
    if (!body.action || !body.listing || !body.listing.id) {
      throw new HttpException('Invalid payload', HttpStatus.BAD_REQUEST);
    }
    return this.searchService.indexListing(body.action, body.listing);
  }

  @Get('health')
  @ApiOperation({ summary: 'Search Service Health' })
  async getHealth() {
    return this.searchService.getHealth();
  }
}
