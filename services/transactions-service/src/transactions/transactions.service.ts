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

    const idempotencyKey = `transaction:idempotency:${buyerId}:${dto.listing_id}`;
    const existing = await this.redis.get(idempotencyKey);
    if (existing) {
      throw new ConflictException('Transaction already initiated for this listing by this buyer');
    }

    const transaction = this.transactionRepo.create({
      listing_id: dto.listing_id,
      seller_id: dto.seller_id,
      buyer_id: buyerId,
      status: TransactionStatus.PENDING_SELLER,
    });

    const saved = await this.transactionRepo.save(transaction);
    await this.redis.set(idempotencyKey, saved.id, 'EX', 24 * 60 * 60);

    // Mock Notification
    await this.notificationsService.sendPushNotification(
      dto.seller_id,
      'New Purchase Request',
      `You have a new purchase request for your listing.`
    );

    return saved;
  }

  async findAll(userId: string, role: string, status: string, page: number, limit: number) {
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
            { headers: { 'x-internal-secret': 'marad-internal-secret-for-webhooks' } }
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
        fetch('http://fraud-service:8001/fraud/transaction/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
