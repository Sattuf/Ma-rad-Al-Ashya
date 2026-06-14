import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendPushNotification(userId: string, title: string, body: string, data?: any) {
    this.logger.log(`[FCM Mock] Sending push notification to User ${userId}`);
    this.logger.log(`[FCM Mock] Title: ${title}`);
    this.logger.log(`[FCM Mock] Body: ${body}`);
    if (data) {
      this.logger.log(`[FCM Mock] Data: ${JSON.stringify(data)}`);
    }
  }
}
