import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('user_rating_summary')
export class UserRatingSummary {
  @PrimaryColumn('uuid')
  user_id: string;

  @Column({ type: 'int', default: 0 })
  total_reviews: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.00 })
  average_rating: number;

  @Column({ type: 'int', default: 0 })
  rating_1_count: number;

  @Column({ type: 'int', default: 0 })
  rating_2_count: number;

  @Column({ type: 'int', default: 0 })
  rating_3_count: number;

  @Column({ type: 'int', default: 0 })
  rating_4_count: number;

  @Column({ type: 'int', default: 0 })
  rating_5_count: number;

  @UpdateDateColumn()
  last_updated: Date;
}
