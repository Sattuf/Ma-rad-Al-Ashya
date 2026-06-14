import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Listing, ListingStatus } from './entities/listing.entity';
import { ListingImage } from './entities/listing-image.entity';
import { StorageService } from '../storage/storage.service';
import Redis from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ListingsService {
  private redis: Redis;
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    @InjectRepository(Listing)
    private listingsRepository: Repository<Listing>,
    @InjectRepository(ListingImage)
    private listingImagesRepository: Repository<ListingImage>,
    private storageService: StorageService,
    private httpService: HttpService,
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  private async triggerSearchIndex(action: 'create' | 'update' | 'delete', listing: any) {
    try {
      const searchServiceUrl = process.env.SEARCH_SERVICE_URL || 'http://localhost:3003';
      const secret = process.env.INTERNAL_SECRET || 'secret123';
      
      await firstValueFrom(
        this.httpService.post(`${searchServiceUrl}/search/index`, {
          action,
          listing,
        }, {
          headers: { 'x-internal-secret': secret }
        })
      );
    } catch (error) {
      this.logger.error(`Failed to trigger search index for listing ${listing.id}: ${error.message}`);
    }
  }

  async create(userId: string, createDto: CreateListingDto): Promise<Listing> {
    const listing = this.listingsRepository.create({
      ...createDto,
      userId,
      status: ListingStatus.ACTIVE,
    });
    const savedListing = await this.listingsRepository.save(listing);
    await this.triggerSearchIndex('create', savedListing);
    return savedListing;
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
      relations: { images: true, category: true },
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
    const updatedListing = await this.listingsRepository.save(listing);
    await this.triggerSearchIndex('update', updatedListing);
    return updatedListing;
  }

  async delete(id: string, userId: string): Promise<void> {
    const listing = await this.findOne(id);
    if (listing.userId !== userId) throw new BadRequestException('Not authorized');
    
    listing.status = ListingStatus.DELETED;
    await this.listingsRepository.save(listing);
    await this.triggerSearchIndex('delete', { id });
  }

  async updateStatus(id: string, userId: string, status: ListingStatus): Promise<Listing> {
    const listing = await this.findOne(id);
    if (listing.userId !== userId) throw new BadRequestException('Not authorized');
    
    listing.status = status;
    const savedListing = await this.listingsRepository.save(listing);
    if (status === ListingStatus.DELETED) {
      await this.triggerSearchIndex('delete', { id });
    } else {
      await this.triggerSearchIndex('update', savedListing);
    }
    return savedListing;
  }

  async updateStatusInternal(id: string, status: ListingStatus): Promise<Listing> {
    const listing = await this.findOne(id);
    listing.status = status;
    const savedListing = await this.listingsRepository.save(listing);
    if (status === ListingStatus.DELETED) {
      await this.triggerSearchIndex('delete', { id });
    } else {
      await this.triggerSearchIndex('update', savedListing);
    }
    return savedListing;
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
