import { Injectable, Logger } from '@nestjs/common';
import { initializeApp, getApps } from 'firebase-admin/app';
// credential is not easily exported in the same way, we can let it auto-initialize in some environments or just not use credential for mock.
// Actually `import * as admin from 'firebase-admin'` still works but `admin.apps` is deprecated or unavailable.
import * as admin from 'firebase-admin';

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);

  constructor() {
    if (!getApps().length) {
      initializeApp(); // uses GOOGLE_APPLICATION_CREDENTIALS
      this.logger.log('Firebase Admin initialized.');
    }
  }

  async sendNotification(userId: string, title: string, body: string, data?: any) {
    this.logger.log(`[MOCK FCM] Sending notification to user ${userId} - Title: ${title}, Body: ${body}`);
    // Real implementation:
    // await admin.messaging().send({ token: 'user_device_token', notification: { title, body }, data });
    return true;
  }
}
