import { Controller, Get, Post, Put, Param, Body, Query, Headers, UnauthorizedException, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { ApiTags, ApiOperation, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { MapSearchDto } from './dto/map-search.dto';
import { RelatedSearchDto } from './dto/related-search.dto';
import { SuggestionsSearchDto } from './dto/suggestions-search.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { TrackClickDto } from './dto/track-click.dto';
import { AdminGuard, extractBearerToken, requireSecret, safeEqual, verifyAccessToken } from '../common/security';

/** Identity for the experiment comes from a verified token only (never a client header). */
function optionalUserId(authorization?: string): string | undefined {
  const token = extractBearerToken(authorization);
  if (!token) return undefined;
  try {
    return verifyAccessToken(token).userId;
  } catch {
    return undefined; // expired/invalid token: treat as anonymous, do not fail the request
  }
}

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('map')
  @ApiOperation({ summary: 'Search listings on map' })
  async mapSearch(@Query() query: MapSearchDto) {
    if (!query.topLeftLat || !query.topLeftLon || !query.bottomRightLat || !query.bottomRightLon) {
      throw new HttpException('Missing bounding box coordinates', HttpStatus.BAD_REQUEST);
    }
    return this.searchService.mapSearch(
      parseFloat(query.topLeftLat as any),
      parseFloat(query.topLeftLon as any),
      parseFloat(query.bottomRightLat as any),
      parseFloat(query.bottomRightLon as any),
      query.zoom ? parseInt(query.zoom as any, 10) : undefined
    );
  }

  @Get('categories/stats')
  @ApiOperation({ summary: 'Get category statistics' })
  async categoryStats() {
    return this.searchService.categoryStats();
  }

  @Get('related')
  @ApiOperation({ summary: 'Get related listings' })
  async relatedSearch(@Query() query: RelatedSearchDto) {
    if (!query.id) {
      throw new HttpException('Listing ID is required', HttpStatus.BAD_REQUEST);
    }
    return this.searchService.relatedSearch(query.id);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Get search suggestions' })
  async suggestions(@Query() query: SuggestionsSearchDto) {
    if (!query.q) {
      throw new HttpException('Query string is required', HttpStatus.BAD_REQUEST);
    }
    return this.searchService.suggestions(query.q);
  }

  @Get()
  @ApiOperation({ summary: 'Ranked text search (A/B experiment); returns ids, total and the variant' })
  async search(@Query() query: SearchQueryDto, @Headers('authorization') authorization?: string) {
    return this.searchService.search(query, optionalUserId(authorization));
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

  @Post('track-click')
  @ApiOperation({ summary: 'Track user click for A/B testing' })
  async trackClick(@Body() body: TrackClickDto, @Headers('authorization') authorization?: string) {
    if (!body.query || !body.variant) {
      throw new HttpException('Missing required fields', HttpStatus.BAD_REQUEST);
    }
    return this.searchService.trackClick(body, optionalUserId(authorization));
  }

  @Get('ranking/stats')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get A/B test ranking stats' })
  async getRankingStats() {
    return this.searchService.getRankingStats();
  }

  @Post('index')
  @ApiOperation({ summary: 'Webhook to index listing modifications' })
  @ApiHeader({ name: 'x-internal-secret', required: true })
  async indexListing(
    @Headers('x-internal-secret') secret: string,
    @Body() body: { action: 'create' | 'update' | 'delete', listing: any }
  ) {
    if (!safeEqual(secret, requireSecret('INTERNAL_SECRET'))) {
      throw new UnauthorizedException('Invalid internal secret');
    }
    if (!body.action || !body.listing || !body.listing.id) {
      throw new HttpException('Invalid payload', HttpStatus.BAD_REQUEST);
    }
    return this.searchService.indexListing(body.action, body.listing);
  }

  @Put('listings/:id/boost')
  @ApiOperation({ summary: 'Internal: Boost a listing in search index' })
  @ApiHeader({ name: 'x-internal-secret', required: true })
  async boostListing(
    @Param('id') id: string,
    @Headers('x-internal-secret') secret: string,
    @Body() body: { boost_multiplier: number; expires_at: string }
  ) {
    if (!safeEqual(secret, requireSecret('INTERNAL_SECRET'))) {
      throw new UnauthorizedException('Invalid internal secret');
    }
    if (body.boost_multiplier === undefined || !body.expires_at) {
      throw new HttpException('Missing boost_multiplier or expires_at', HttpStatus.BAD_REQUEST);
    }
    return this.searchService.boostListing(id, body.boost_multiplier, body.expires_at);
  }

  @Get('health')
  @ApiOperation({ summary: 'Search Service Health' })
  async getHealth() {
    return this.searchService.getHealth();
  }
}
