import { Controller, Post, Get, Body, Param, Req, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/review.dto';
import { Request } from 'express';
import { AuthUser, JwtAuthGuard } from '../common/security';

function getUserId(req: Request): string {
  return (req['user'] as AuthUser).userId;
}

@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('transactions/:id/review')
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
