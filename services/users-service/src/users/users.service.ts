import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';
import { StorageService } from '../storage/storage.service';
import Redis from 'ioredis';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { internalHeaders } from '../common/security';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  private redis: Redis;

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private storageService: StorageService,
    private httpService: HttpService,
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async getPublicProfile(userId: string) {
    const user = await this.getProfile(userId);
    return {
      id: user.id,
      full_name: user.full_name,
      bio: user.bio,
      city: user.city,
      avatar_url: user.avatar_url,
      is_identity_verified: user.is_identity_verified,
      created_at: user.created_at,
    };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto): Promise<User> {
    const user = await this.getProfile(userId);
    Object.assign(user, updateProfileDto);
    return this.usersRepository.save(user);
  }

  async updateAvatar(userId: string, file: Express.Multer.File): Promise<User> {
    const user = await this.getProfile(userId);
    const avatarUrl = await this.storageService.uploadAvatar(file);
    user.avatar_url = avatarUrl;
    return this.usersRepository.save(user);
  }

  async updateNotifications(userId: string, updateNotificationsDto: UpdateNotificationsDto): Promise<User> {
    const user = await this.getProfile(userId);
    Object.assign(user, updateNotificationsDto);
    return this.usersRepository.save(user);
  }

  async updateFcmToken(userId: string, updateFcmTokenDto: UpdateFcmTokenDto): Promise<User> {
    const user = await this.getProfile(userId);
    user.fcm_token = updateFcmTokenDto.fcm_token;
    return this.usersRepository.save(user);
  }

  async updateStatus(userId: string, status: string): Promise<User> {
    const result = await this.usersRepository.update({ id: userId }, { status });
    if (!result.affected) {
      throw new NotFoundException('User not found');
    }
    return this.getProfile(userId);
  }

  async verifyUser(userId: string): Promise<User> {
    const user = await this.getProfile(userId);
    user.is_identity_verified = true;
    user.identity_verified_at = new Date();
    return this.usersRepository.save(user);
  }

  async addFavorite(userId: string, listingId: string): Promise<{ favorited: boolean, count: number }> {
    await this.redis.sadd(`favorites:${userId}`, listingId);
    const count = await this.redis.scard(`favorites:${userId}`);
    return { favorited: true, count };
  }

  async removeFavorite(userId: string, listingId: string): Promise<{ favorited: boolean, count: number }> {
    await this.redis.srem(`favorites:${userId}`, listingId);
    const count = await this.redis.scard(`favorites:${userId}`);
    return { favorited: false, count };
  }

  async getFavorites(userId: string, page: number = 1, limit: number = 20): Promise<{ data: any[], total: number }> {
    const members = await this.redis.smembers(`favorites:${userId}`);
    const total = members.length;
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedIds = members.slice(startIndex, endIndex);

    if (paginatedIds.length === 0) {
      return { data: [], total };
    }

    try {
      const listingsServiceUrl = process.env.LISTINGS_SERVICE_URL || 'http://listings-service:3002';
      
      const response = await firstValueFrom(
        this.httpService.post(`${listingsServiceUrl}/listings/batch`, 
          { ids: paginatedIds }, 
          { headers: internalHeaders(), timeout: 5000 }
        )
      );

      const listings = response.data.filter((l: any) => l !== null);
      return { data: listings, total };
    } catch (error) {
      // The message only: the axios error carries the request config, internal secret included.
      this.logger.warn(`Failed to fetch favorite listings data: ${(error as Error).message}`);
      return { data: [], total };
    }
  }

  async checkFavorite(userId: string, listingId: string): Promise<{ favorited: boolean }> {
    const isMember = await this.redis.sismember(`favorites:${userId}`, listingId);
    return { favorited: isMember === 1 };
  }
}
