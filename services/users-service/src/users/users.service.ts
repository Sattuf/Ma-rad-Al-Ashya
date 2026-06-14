import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private storageService: StorageService,
  ) {}

  async getProfile(userId: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
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
}
