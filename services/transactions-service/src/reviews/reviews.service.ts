import { Injectable, ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Review } from './entities/review.entity';
import { UserRatingSummary } from './entities/user-rating-summary.entity';
import { CreateReviewDto } from './dto/review.dto';
import { Transaction, TransactionStatus } from '../transactions/entities/transaction.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(UserRatingSummary) private readonly summaryRepo: Repository<UserRatingSummary>,
    @InjectRepository(Transaction) private readonly transactionRepo: Repository<Transaction>,
    private readonly dataSource: DataSource,
  ) {}

  async create(transactionId: string, reviewerId: string, dto: CreateReviewDto): Promise<Review> {
    const transaction = await this.transactionRepo.findOne({ where: { id: transactionId } });
    if (!transaction) throw new NotFoundException('Transaction not found');
    
    if (transaction.status !== TransactionStatus.COMPLETED) {
      throw new BadRequestException('Transaction must be completed to leave a review');
    }

    if (transaction.buyer_id !== reviewerId && transaction.seller_id !== reviewerId) {
      throw new ForbiddenException('You are not a participant in this transaction');
    }

    const revieweeId = reviewerId === transaction.buyer_id ? transaction.seller_id : transaction.buyer_id;

    const existingReview = await this.reviewRepo.findOne({
      where: { transaction_id: transactionId, reviewer_id: reviewerId },
    });
    if (existingReview) {
      throw new ConflictException('You have already reviewed this transaction');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const review = queryRunner.manager.create(Review, {
        transaction_id: transactionId,
        reviewer_id: reviewerId,
        reviewee_id: revieweeId,
        listing_id: transaction.listing_id,
        rating: dto.rating,
        comment: dto.comment,
      });

      const savedReview = await queryRunner.manager.save(review);

      let summary = await queryRunner.manager.findOne(UserRatingSummary, { where: { user_id: revieweeId } });
      if (!summary) {
        summary = queryRunner.manager.create(UserRatingSummary, {
          user_id: revieweeId,
        });
      }

      summary.total_reviews += 1;
      (summary as any)[`rating_${dto.rating}_count`] += 1;
      
      const totalScore = (summary.rating_1_count * 1) + (summary.rating_2_count * 2) + 
                         (summary.rating_3_count * 3) + (summary.rating_4_count * 4) + 
                         (summary.rating_5_count * 5);
                         
      summary.average_rating = totalScore / summary.total_reviews;
      summary.last_updated = new Date();

      await queryRunner.manager.save(summary);

      await queryRunner.commitTransaction();
      return savedReview;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getUserReviews(userId: string, page: number, limit: number) {
    const summary = await this.summaryRepo.findOne({ where: { user_id: userId } });
    const reviews = await this.reviewRepo.find({
      where: { reviewee_id: userId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      summary: summary || { user_id: userId, total_reviews: 0, average_rating: 0 },
      reviews,
    };
  }
}
