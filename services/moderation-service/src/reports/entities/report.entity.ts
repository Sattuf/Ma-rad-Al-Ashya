import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';

@Entity('reports')
@Unique(['reporter_id', 'target_type', 'target_id'])
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  reporter_id: string;

  @Column({ length: 10 })
  target_type: string; // 'listing' or 'user'

  @Column('uuid')
  target_id: string;

  @Column({ length: 20 })
  reason: string;

  @Column('text', { nullable: true })
  description: string;

  @Column({ length: 15, default: 'pending' })
  status: string;

  @Column('uuid', { nullable: true })
  reviewed_by: string;

  @Column('timestamp', { nullable: true })
  reviewed_at: Date;

  @Column({ length: 20, nullable: true })
  action_taken: string;

  @Column('text', { nullable: true })
  admin_note: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
