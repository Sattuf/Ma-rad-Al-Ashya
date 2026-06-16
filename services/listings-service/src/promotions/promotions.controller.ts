import { Controller, Get, Post, Body, UseGuards, Request, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PromotionsService } from './promotions.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Get all promotion plans' })
  getPlans() {
    return this.promotionsService.getPlans();
  }

  @Post('create-payment-intent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a Stripe Payment Intent for a listing promotion' })
  createPaymentIntent(@Request() req, @Body() dto: CreatePaymentIntentDto) {
    return this.promotionsService.createPaymentIntent(req.user.userId, dto.listingId, dto.plan);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook listener' })
  async handleWebhook(@Request() req) {
    const signature = req.headers['stripe-signature'];
    const rawBody = req.body;
    return this.promotionsService.handleWebhook(rawBody, signature);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user\'s promotions' })
  getMy(@Request() req) {
    return this.promotionsService.getMyPromotions(req.user.userId);
  }
}
