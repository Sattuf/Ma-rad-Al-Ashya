import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  Headers,
  RawBodyRequest,
  UseGuards,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { KycService } from '../services/kyc.service';
import { AdminGuard, AuthUser, JwtAuthGuard } from '../common/security';
import { verifyWebhookSignature } from '../services/webhook-signature';

type AuthedRequest = Request & { user: AuthUser };

@Controller('identity')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  /** The user being verified is always the caller, never a value from the body. */
  @Post('kyc/start')
  @UseGuards(JwtAuthGuard)
  async startKyc(@Req() req: AuthedRequest) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.kycService.startVerification(req.user.userId, ipAddress);
  }

  @Get('kyc/status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req: AuthedRequest) {
    return this.kycService.getStatus(req.user.userId);
  }

  @Post('kyc/webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-signature') signature?: string,
    @Headers('x-didit-signature') legacySignature?: string,
    @Headers('x-timestamp') timestamp?: string,
  ) {
    const rawBody = req.rawBody ?? (Buffer.isBuffer(req.body) ? req.body : undefined);
    if (!verifyWebhookSignature(rawBody, signature ?? legacySignature, timestamp)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const body = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8')) : req.body;
    await this.kycService.handleWebhook(body, req.ip || req.socket.remoteAddress);
    return { received: true };
  }

  @Get('kyc/session/:sessionId')
  @UseGuards(AdminGuard)
  async getSession(@Param('sessionId') sessionId: string) {
    return this.kycService.getSessionData(sessionId);
  }

  @Post('admin/decrypt')
  @UseGuards(AdminGuard)
  async decryptAdmin(@Req() req: AuthedRequest, @Body() body: { sessionId: string }) {
    return this.kycService.decryptData(body?.sessionId, req.user.userId);
  }
}
