import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findOneById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  async findOneByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ phone });
  }

  async findOneByGoogleId(googleId: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ googleId });
  }

  async findOneByFacebookId(facebookId: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ facebookId });
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  async update(id: string, updateData: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, updateData);
    const updatedUser = await this.findOneById(id);
    if (!updatedUser) {
      throw new Error(`User with ID ${id} not found after update`);
    }
    return updatedUser;
  }
}
