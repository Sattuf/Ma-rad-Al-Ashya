import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  transaction_id: string;

  @Column('uuid')
  reviewer_id: string;

  @Column('uuid')
  reviewee_id: string;

  @Column('uuid')
  listing_id: string;

  @Column('smallint')
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @CreateDateColumn()
  created_at: Date;
}
