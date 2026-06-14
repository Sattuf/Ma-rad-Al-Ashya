import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Listing, ListingStatus } from './entities/listing.entity';
import { ListingImage } from './entities/listing-image.entity';
import { StorageService } from '../storage/storage.service';
import Redis from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

@Injectable()
export class ListingsService {
  private redis: Redis;

  constructor(
    @InjectRepository(Listing)
    private listingsRepository: Repository<Listing>,
    @InjectRepository(ListingImage)
    private listingImagesRepository: Repository<ListingImage>,
    private storageService: StorageService,
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  async create(userId: string, createDto: CreateListingDto): Promise<Listing> {
    const listing = this.listingsRepository.create({
      ...createDto,
      userId,
      status: ListingStatus.ACTIVE,
    });
    return this.listingsRepository.save(listing);
  }

  async findAll(query: any): Promise<Listing[]> {
    const { categoryId, status, search, userId } = query;
    const qb = this.listingsRepository.createQueryBuilder('listing')
      .leftJoinAndSelect('listing.images', 'images');

    if (categoryId) qb.andWhere('listing.categoryId = :categoryId', { categoryId });
    if (status) qb.andWhere('listing.status = :status', { status });
    if (userId) qb.andWhere('listing.userId = :userId', { userId });
    if (search) qb.andWhere('listing.title ILIKE :search', { search: `%${search}%` });

    return qb.getMany();
  }

  async findOne(id: string): Promise<Listing> {
    const listing = await this.listingsRepository.findOne({
      where: { id },
      relations: ['images', 'category'],
    });

    if (!listing) throw new NotFoundException('Listing not found');

    return listing;
  }

  async incrementView(id: string): Promise<void> {
    await this.redis.incr(`listing:views:${id}`);
  }

  async update(id: string, userId: string, updateDto: UpdateListingDto): Promise<Listing> {
    const listing = await this.findOne(id);
    if (listing.userId !== userId) throw new BadRequestException('Not authorized');

    Object.assign(listing, updateDto);
    return this.listingsRepository.save(listing);
  }

  async delete(id: string, userId: string): Promise<void> {
    const listing = await this.findOne(id);
    if (listing.userId !== userId) throw new BadRequestException('Not authorized');
    
    listing.status = ListingStatus.DELETED;
    await this.listingsRepository.save(listing);
  }

  async updateStatus(id: string, userId: string, status: ListingStatus): Promise<Listing> {
    const listing = await this.findOne(id);
    if (listing.userId !== userId) throw new BadRequestException('Not authorized');
    
    listing.status = status;
    return this.listingsRepository.save(listing);
  }

  async addImage(listingId: string, userId: string, file: Express.Multer.File): Promise<ListingImage> {
    const listing = await this.findOne(listingId);
    if (listing.userId !== userId) throw new BadRequestException('Not authorized');

    const imageCount = await this.listingImagesRepository.count({ where: { listingId } });
    if (imageCount >= 10) throw new BadRequestException('Maximum 10 images allowed');

    const { imageUrl, thumbnailUrl } = await this.storageService.uploadListingImage(file);
    
    const image = this.listingImagesRepository.create({
      listingId,
      imageUrl,
      thumbnailUrl,
      sortOrder: imageCount,
    });

    return this.listingImagesRepository.save(image);
  }

  async deleteImage(listingId: string, imageId: string, userId: string): Promise<void> {
    const listing = await this.findOne(listingId);
    if (listing.userId !== userId) throw new BadRequestException('Not authorized');

    const image = await this.listingImagesRepository.findOne({ where: { id: imageId, listingId } });
    if (!image) throw new NotFoundException('Image not found');

    await this.listingImagesRepository.remove(image);
  }

  async findByUser(userId: string): Promise<Listing[]> {
    return this.findAll({ userId });
  }

  async findByCategory(categoryId: string): Promise<Listing[]> {
    return this.findAll({ categoryId });
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncViews() {
    const keys = await this.redis.keys('listing:views:*');
    for (const key of keys) {
      const id = key.replace('listing:views:', '');
      const viewsStr = await this.redis.get(key);
      const views = parseInt(viewsStr || '0', 10);
      
      if (views > 0) {
        await this.listingsRepository.increment({ id }, 'viewsCount', views);
        await this.redis.set(key, '0');
      }
    }
  }
}
