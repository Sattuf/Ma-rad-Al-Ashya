import { Controller, Post, Get, Body, Param, Req, Headers, RawBodyRequest } from '@nestjs/common';
import { KycService } from '../services/kyc.service';
import { Request } from 'express';

@Controller('identity')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('kyc/start')
  async startKyc(@Body() body: { userId: string }, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.kycService.startVerification(body.userId, ipAddress);
  }

  @Get('kyc/status')
  async getStatus(@Body() body: { userId: string }, @Req() req: Request) {
    // Note: In real setup, user ID should come from JWT token in Request
    const userId = body.userId || req.headers['x-user-id'] as string;
    return this.kycService.getStatus(userId);
  }

  @Post('kyc/webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>, 
    @Headers('X-Didit-Signature') signature: string
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    
    // In NestJS, to use raw body, it must be enabled in main.ts
    // For now we'll parse the standard body if rawBody is not available
    const body = req.body;
    
    await this.kycService.handleWebhook(body, signature, ipAddress);
    return { received: true };
  }

  @Get('kyc/session/:sessionId')
  async getSession(@Param('sessionId') sessionId: string) {
    return this.kycService.getSessionData(sessionId);
  }

  @Post('admin/decrypt')
  async decryptAdmin(@Body() body: { sessionId: string }) {
    // Real setup should verify admin privileges here
    return this.kycService.decryptData(body.sessionId);
  }
}
