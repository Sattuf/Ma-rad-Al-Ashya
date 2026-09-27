import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { UsersService } from './users.service';
import { UsersController, UsersInternalController, UsersPublicController } from './users.controller';
import { User } from './entities/user.entity';
import { StorageService } from '../storage/storage.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), HttpModule],
  controllers: [UsersController, UsersInternalController, UsersPublicController],
  providers: [UsersService, StorageService],
  exports: [UsersService],
})
export class UsersModule {}
