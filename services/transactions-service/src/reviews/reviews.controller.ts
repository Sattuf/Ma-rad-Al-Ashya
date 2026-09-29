import { Controller, Post, Get, Body, Param, Req, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/review.dto';
import { Request } from 'express';
import { AuthUser, JwtAuthGuard } from '../common/security';

// JwtAuthGuard puts the verified user on the request; @types/express does not declare it
// (and its typings change between versions), so read it through an explicit shape.
function getUserId(req: Request): string {
  return (req as unknown as { user: AuthUser }).user.userId;
}

@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // ':id/reviews' is the path clients reach through the gateway (/api/v1/transactions/:id/reviews).
  @Post(['transactions/:id/review', ':id/reviews'])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Leave a review for a completed transaction' })
  async createReview(
    @Req() req: Request,
    @Param('id') transactionId: string,
    @Body() dto: CreateReviewDto
  ) {
    const userId = getUserId(req);
    return this.reviewsService.create(transactionId, userId, dto);
  }

  @Get('users/:userId/rating-summary')
  @ApiOperation({ summary: 'Get a user rating summary' })
  async getRatingSummary(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.reviewsService.getRatingSummary(userId);
  }

  @Get('users/:userId/reviews')
  @ApiOperation({ summary: 'Get user reviews and rating summary' })
  async getUserReviews(
    @Param('userId') userId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10'
  ) {
    return this.reviewsService.getUserReviews(userId, parseInt(page, 10), parseInt(limit, 10));
  }
}
