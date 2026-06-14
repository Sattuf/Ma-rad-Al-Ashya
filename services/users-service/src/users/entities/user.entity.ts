import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  full_name: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  avatar_url: string;

  @Column({ default: true })
  notification_messages: boolean;

  @Column({ default: true })
  notification_listings: boolean;

  @Column({ default: true })
  notification_transactions: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ nullable: true })
  fcm_token: string;
}
