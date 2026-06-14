import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum TransactionStatus {
  PENDING_SELLER = 'pending_seller',
  PENDING_BUYER = 'pending_buyer',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  listing_id: string;

  @Column('uuid')
  seller_id: string;

  @Column('uuid')
  buyer_id: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: TransactionStatus.PENDING_SELLER,
  })
  status: TransactionStatus;

  @Column({ type: 'timestamp', nullable: true })
  seller_confirmed_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  buyer_confirmed_at: Date;

  @Column({ type: 'uuid', nullable: true })
  cancelled_by: string;

  @Column({ type: 'text', nullable: true })
  cancel_reason: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
