import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { ListingImage } from './listing-image.entity';

export enum ListingCondition {
  NEW = 'new',
  USED = 'used',
}

export enum ListingStatus {
  ACTIVE = 'active',
  SOLD = 'sold',
  EXPIRED = 'expired',
  DELETED = 'deleted',
}

@Entity('listings')
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'category_id', nullable: true })
  categoryId: string;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column('decimal', { precision: 12, scale: 2 })
  price: number;

  @Column({ default: 'USD' })
  currency: string;

  /** NULL for listings created before sellers were asked ("not specified"). */
  @Column({ type: 'varchar', length: 10, nullable: true })
  condition: ListingCondition | null;

  /** Free text: city / neighbourhood, as the seller typed it. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  location: string | null;

  @Column({ type: 'varchar', default: ListingStatus.ACTIVE })
  status: ListingStatus;

  @Column({ name: 'views_count', default: 0 })
  viewsCount: number;

  @OneToMany(() => ListingImage, image => image.listing, { cascade: true })
  images: ListingImage[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
