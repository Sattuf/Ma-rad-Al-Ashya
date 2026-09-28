import { Injectable, ConflictException, ForbiddenException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionStatus } from './entities/transaction.entity';
import { CreateTransactionDto, CancelTransactionDto } from './dto/transaction.dto';
import { getNextStatus, TransactionAction, ActorRole } from './fsm/transaction-fsm';
import Redis from 'ioredis';
import { NotificationsService } from '../notifications/notifications.service';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { internalHeaders } from '../common/security';

const MAX_PAGE_SIZE = 50;

export function clampPagination(page: number, limit: number): { page: number; limit: number } {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), MAX_PAGE_SIZE) : 10;
  return { page: safePage, limit: safeLimit };
}

@Injectable()
export class TransactionsService {
  private readonly redis: Redis;
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly notificationsService: NotificationsService,
    private readonly httpService: HttpService
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });
  }

  async create(buyerId: string, dto: CreateTransactionDto): Promise<Transaction> {
    if (buyerId === dto.seller_id) {
      throw new BadRequestException('Buyer cannot be the same as seller');
    }

    await this.assertListingPurchasable(dto.listing_id, dto.seller_id);

    // SET NX makes the idempotency check atomic under concurrent requests
    const idempotencyKey = `transaction:idempotency:${buyerId}:${dto.listing_id}`;
    const acquired = await this.redis.set(idempotencyKey, 'pending', 'EX', 24 * 60 * 60, 'NX');
    if (!acquired) {
      throw new ConflictException('Transaction already initiated for this listing by this buyer');
    }

    const transaction = this.transactionRepo.create({
      listing_id: dto.listing_id,
      seller_id: dto.seller_id,
      buyer_id: buyerId,
      status: TransactionStatus.PENDING_SELLER,
    });

    let saved: Transaction;
    try {
      saved = await this.transactionRepo.save(transaction);
    } catch (err) {
      await this.redis.del(idempotencyKey);
      throw err;
    }
    await this.redis.set(idempotencyKey, saved.id, 'EX', 24 * 60 * 60);

    // Mock Notification
    await this.notificationsService.sendPushNotification(
      dto.seller_id,
      'New Purchase Request',
      `You have a new purchase request for your listing.`
    );

    return saved;
  }

  /** The seller must be the listing owner and the listing must still be for sale. */
  private async assertListingPurchasable(listingId: string, sellerId: string): Promise<void> {
    const url = `${process.env.LISTINGS_SERVICE_URL || 'http://listings-service:3002'}/listings/batch`;
    let listing: { userId?: string; status?: string } | null = null;
    try {
      const res = await lastValueFrom(
        this.httpService.post(url, { ids: [listingId] }, { headers: internalHeaders(), timeout: 5000 }),
      );
      listing = Array.isArray(res.data) ? res.data[0] : null;
    } catch (err) {
      this.logger.error(`Failed to verify listing ${listingId}: ${err.message}`);
      throw new BadRequestException('Unable to verify listing, please try again');
    }
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.userId !== sellerId) {
      throw new BadRequestException('Seller does not own this listing');
    }
    if (listing.status !== 'active') {
      throw new BadRequestException('Listing is not available for purchase');
    }
  }

  async findAll(userId: string, role: string, status: string, rawPage: number, rawLimit: number) {
    const { page, limit } = clampPagination(rawPage, rawLimit);
    const query = this.transactionRepo.createQueryBuilder('t');
    
    if (role === 'buyer') {
      query.andWhere('t.buyer_id = :userId', { userId });
    } else if (role === 'seller') {
      query.andWhere('t.seller_id = :userId', { userId });
    } else {
      query.andWhere('(t.buyer_id = :userId OR t.seller_id = :userId)', { userId });
    }

    if (status) {
      query.andWhere('t.status = :status', { status });
    }

    query.skip((page - 1) * limit).take(limit).orderBy('t.created_at', 'DESC');

    const [items, total] = await query.getManyAndCount();
    return { items, total, page, limit };
  }

  async findOne(id: string, userId: string): Promise<Transaction> {
    const tx = await this.transactionRepo.findOne({ where: { id } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.buyer_id !== userId && tx.seller_id !== userId) {
      throw new ForbiddenException('You are not a participant in this transaction');
    }
    return tx;
  }

  async confirm(id: string, userId: string): Promise<Transaction> {
    const tx = await this.findOne(id, userId);
    const role = tx.seller_id === userId ? ActorRole.SELLER : ActorRole.BUYER;

    const { nextStatus, error } = getNextStatus(tx.status, TransactionAction.CONFIRM, role);
    if (error) {
      throw new BadRequestException(error);
    }

    tx.status = nextStatus!;
    if (role === ActorRole.SELLER) {
      tx.seller_confirmed_at = new Date();
      await this.notificationsService.sendPushNotification(
        tx.buyer_id,
        'Seller Confirmed',
        'The seller has confirmed the transaction. Please confirm upon receiving.'
      );
    } else {
      tx.buyer_confirmed_at = new Date();
      await this.notificationsService.sendPushNotification(
        tx.seller_id,
        'Transaction Completed',
        'The buyer has confirmed receiving the item.'
      );

      // Call listings-service to update status
      try {
        const url = `${process.env.LISTINGS_SERVICE_URL || 'http://listings-service:3002'}/listings/${tx.listing_id}/status`;
        await lastValueFrom(
          this.httpService.put(
            url,
            { status: 'sold' },
            { headers: internalHeaders(), timeout: 5000 }
          )
        );
      } catch (err) {
        this.logger.error(`Failed to update listing status: ${err.message}`);
      }
    }

    const saved = await this.transactionRepo.save(tx);

    if (saved.status === TransactionStatus.COMPLETED) {
      // Fire-and-forget fraud analysis
      setImmediate(() => {
        fetch(`${process.env.FRAUD_SERVICE_URL || 'http://fraud-service:8001'}/fraud/transaction/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...internalHeaders() },
          body: JSON.stringify({
            transaction_id: saved.id,
            buyer_id: saved.buyer_id,
            seller_id: saved.seller_id,
            price: 0, // Mock or fetch from listing if needed
            buyer_account_age_days: 30, // Mock or calculate if user info available
            seller_account_age_days: 30, // Mock
            buyer_completed_transactions: 1, // Mock
          }),
        }).catch(err => {
          this.logger.error(`Failed to send transaction fraud analysis: ${err.message}`);
        });
      });
    }

    return saved;
  }

  async cancel(id: string, userId: string, dto: CancelTransactionDto): Promise<Transaction> {
    const tx = await this.findOne(id, userId);
    const role = tx.seller_id === userId ? ActorRole.SELLER : ActorRole.BUYER;

    const { nextStatus, error } = getNextStatus(tx.status, TransactionAction.CANCEL, role);
    if (error) {
      throw new BadRequestException(error);
    }

    tx.status = nextStatus!;
    tx.cancelled_by = userId;
    tx.cancel_reason = dto.reason ?? '';

    const otherParty = role === ActorRole.SELLER ? tx.buyer_id : tx.seller_id;
    await this.notificationsService.sendPushNotification(
      otherParty,
      'Transaction Cancelled',
      'The transaction has been cancelled.'
    );

    return this.transactionRepo.save(tx);
  }
}
