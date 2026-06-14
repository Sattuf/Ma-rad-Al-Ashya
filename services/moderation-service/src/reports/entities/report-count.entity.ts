import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('report_counts')
export class ReportCount {
  @PrimaryColumn({ length: 10 })
  target_type: string;

  @PrimaryColumn('uuid')
  target_id: string;

  @Column('int', { default: 0 })
  pending_count: number;

  @Column('int', { default: 0 })
  total_count: number;

  @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
  last_reported_at: Date;
}
