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
import { internalHeaders } from '../common/security';

export const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;
/** Statuses visible to the public. Deleted/expired listings never leave the service. */
const PUBLIC_STATUSES: string[] = [ListingStatus.ACTIVE, ListingStatus.SOLD];
/** Statuses an owner may set directly (deletion goes through DELETE). */
const OWNER_SETTABLE_STATUSES: string[] = [ListingStatus.ACTIVE, ListingStatus.SOLD];

export interface ListingsPage {
  data: Listing[];
  meta: { total: number; page: number; limit: number; lastPage: number };
}

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Escapes LIKE wildcards so user input is matched literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

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
      
      let enrichedListing = { ...listing };
      
      if (action !== 'delete') {
        let sellerRating = 0;
        try {
          const transactionsUrl = process.env.TRANSACTIONS_SERVICE_URL || 'http://localhost:3006';
          const ratingRes = await firstValueFrom(
            this.httpService.get(`${transactionsUrl}/users/${listing.userId}/reviews`, { timeout: 5000 })
          );
          if (ratingRes.data && ratingRes.data.summary) {
            sellerRating = Number(ratingRes.data.summary.average_rating) || 0;
          }
        } catch (e) {
          // ignore if not found or errors
        }
        
        let imagesCount = 0;
        if (listing.images && Array.isArray(listing.images)) {
          imagesCount = listing.images.length;
        } else if (listing.id) {
          imagesCount = await this.listingImagesRepository.count({ where: { listingId: listing.id } });
        }

        enrichedListing.images_count = imagesCount;
        enrichedListing.description_length = listing.description ? listing.description.length : 0;
        enrichedListing.seller_average_rating = sellerRating;
      }
      
      await firstValueFrom(
        this.httpService.post(`${searchServiceUrl}/search/index`, {
          action,
          listing: enrichedListing,
        }, {
          headers: internalHeaders(), timeout: 5000
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
    // Indexing must not add latency to (or fail) the user's request.
    // TODO(phase 2): move to an outbox + queue so no index update is ever lost.
    void this.triggerSearchIndex('create', savedListing);
    return savedListing;
  }

  /**
   * Public listing query. Always paginated (max 50 rows) and ordered by an indexed
   * column, so the cost per request stays bounded no matter how large the table grows.
   */
  async findAll(query: Record<string, any> = {}): Promise<ListingsPage> {
    const categoryId = query.categoryId ?? query.category_id;
    const userId = query.userId;
    const search = typeof (query.search ?? query.q) === 'string' ? String(query.search ?? query.q).trim().slice(0, 100) : '';
    const status = PUBLIC_STATUSES.includes(query.status) ? query.status : ListingStatus.ACTIVE;
    const page = toPositiveInt(query.page, 1);
    const limit = Math.min(toPositiveInt(query.limit, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

    const qb = this.listingsRepository
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.images', 'images')
      .where('listing.status = :status', { status });

    if (categoryId) qb.andWhere('listing.categoryId = :categoryId', { categoryId });
    if (userId) qb.andWhere('listing.userId = :userId', { userId });
    if (search) qb.andWhere("listing.title ILIKE :search ESCAPE '\\'", { search: `%${escapeLike(search)}%` });

    qb.orderBy('listing.createdAt', 'DESC')
      .addOrderBy('listing.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit, lastPage: Math.max(1, Math.ceil(total / limit)) } };
  }

  /** Listings of the signed-in owner (all statuses except deleted). */
  async findMine(userId: string, query: Record<string, any> = {}): Promise<ListingsPage> {
    const page = toPositiveInt(query.page, 1);
    const limit = Math.min(toPositiveInt(query.limit, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
    const [data, total] = await this.listingsRepository
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.images', 'images')
      .where('listing.userId = :userId', { userId })
      .andWhere('listing.status != :deleted', { deleted: ListingStatus.DELETED })
      .orderBy('listing.createdAt', 'DESC')
      .addOrderBy('listing.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: { total, page, limit, lastPage: Math.max(1, Math.ceil(total / limit)) } };
  }

  /** Public lookup: deleted listings are not found. */
  async findOne(id: string): Promise<Listing> {
    const listing = await this.findOneAnyStatus(id);
    if (listing.status === ListingStatus.DELETED) throw new NotFoundException('Listing not found');
    return listing;
  }

  private async findOneAnyStatus(id: string): Promise<Listing> {
    const listing = await this.listingsRepository.findOne({
      where: { id },
      relations: { images: true, category: true },
    });

    if (!listing) throw new NotFoundException('Listing not found');

    return listing;
  }

  async findBatch(ids: string[]): Promise<(Listing | null)[]> {
    if (!ids || ids.length === 0) return [];
    
    const listings = await this.listingsRepository.find({
      where: { id: In(ids) },
    });
    
    const listingsMap = new Map(listings.map(l => [l.id, l]));
    
    return ids.map(id => {
      const listing = listingsMap.get(id);
      if (!listing || listing.status === ListingStatus.DELETED) {
        return null;
      }
      return listing;
    });
  }

  async incrementView(id: string): Promise<void> {
    await this.redis.incr(`listing:views:${id}`);
  }

  async update(id: string, userId: string, updateDto: UpdateListingDto): Promise<Listing> {
    const listing = await this.findOne(id);
    if (listing.userId !== userId) throw new BadRequestException('Not authorized');

    Object.assign(listing, updateDto);
    const updatedListing = await this.listingsRepository.save(listing);
    void this.triggerSearchIndex('update', updatedListing);
    return updatedListing;
  }

  async delete(id: string, userId: string): Promise<void> {
    const listing = await this.findOne(id);
    if (listing.userId !== userId) throw new BadRequestException('Not authorized');
    
    listing.status = ListingStatus.DELETED;
    await this.listingsRepository.save(listing);
    void this.triggerSearchIndex('delete', { id });
  }

  async updateStatus(id: string, userId: string, status: ListingStatus): Promise<Listing> {
    if (!OWNER_SETTABLE_STATUSES.includes(status)) {
      throw new BadRequestException(`Status must be one of: ${OWNER_SETTABLE_STATUSES.join(', ')}`);
    }
    const listing = await this.findOne(id);
    if (listing.userId !== userId) throw new BadRequestException('Not authorized');

    listing.status = status;
    const savedListing = await this.listingsRepository.save(listing);
    void this.triggerSearchIndex('update', savedListing);
    return savedListing;
  }

  async updateStatusInternal(id: string, status: ListingStatus): Promise<Listing> {
    if (!Object.values(ListingStatus).includes(status)) {
      throw new BadRequestException('Invalid status');
    }
    const listing = await this.findOneAnyStatus(id);
    listing.status = status;
    const savedListing = await this.listingsRepository.save(listing);
    if (status === ListingStatus.DELETED) {
      void this.triggerSearchIndex('delete', { id });
    } else {
      void this.triggerSearchIndex('update', savedListing);
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

  async findByUser(userId: string, query: Record<string, any> = {}): Promise<ListingsPage> {
    return this.findAll({ ...query, userId });
  }

  async findByCategory(categoryId: string, query: Record<string, any> = {}): Promise<ListingsPage> {
    return this.findAll({ ...query, categoryId });
  }

  /**
   * Flushes buffered view counters to Postgres. SCAN (not KEYS) keeps Redis responsive,
   * and GETDEL reads-and-resets atomically so views arriving meanwhile are not lost.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncViews() {
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', 'listing:views:*', 'COUNT', 500);
      cursor = next;
      for (const key of keys) {
        const views = parseInt((await this.redis.getdel(key)) || '0', 10);
        if (views > 0) {
          const id = key.replace('listing:views:', '');
          await this.listingsRepository.increment({ id }, 'viewsCount', views);
        }
      }
    } while (cursor !== '0');
  }

  sendViewEvent(listingId: string, categoryId: string, authHeader?: string) {
    // Personalization only uses events of signed-in users.
    if (!authHeader) return;
    setImmediate(async () => {
      try {
        const personalizationUrl = process.env.PERSONALIZATION_SERVICE_URL || 'http://personalization-service:8002';
        const headers = { authorization: authHeader };
        await firstValueFrom(
          this.httpService.post(`${personalizationUrl}/events`, {
            event_type: 'view',
            listing_id: listingId,
            category_id: categoryId,
          }, { headers })
        );
      } catch (error) {
        this.logger.error(`Failed to send view event for listing ${listingId}: ${error.message}`);
      }
    });
  }
}

