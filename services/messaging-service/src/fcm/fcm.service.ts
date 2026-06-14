import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);

  async sendNotification(userId: string, title: string, body: string, data?: any) {
    this.logger.log(`[MOCK FCM] Sending notification to user ${userId} - Title: ${title}, Body: ${body}`);
    // Mock implementation for sending FCM notification
    return true;
  }
}
