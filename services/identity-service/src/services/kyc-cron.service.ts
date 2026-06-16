import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { KycService } from './kyc.service';

@Injectable()
export class KycCronService {
  private readonly logger = new Logger(KycCronService.name);

  constructor(private readonly kycService: KycService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    this.logger.log('Running scheduled job to mark expired KYC sessions...');
    await this.kycService.markExpiredSessions();
  }
}
