import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';

@Processor('auto-review')
export class AutoReviewProcessor {
  private readonly logger = new Logger(AutoReviewProcessor.name);

  @Process('auto_review_listing')
  async handleListingReview(job: Job) {
    this.logger.warn(`Auto reviewing listing: ${job.data.target_id}`);
    // Future: Call AI service or apply heuristics
  }

  @Process('auto_review_user')
  async handleUserReview(job: Job) {
    this.logger.warn(`Auto reviewing user: ${job.data.target_id}`);
    // Future: Check user history, spam heuristics
  }
}
