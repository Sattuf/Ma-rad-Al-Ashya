import { Controller, Get, Put, Post, Body, UseGuards, Request, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  getProfile(@Request() req) {
    return this.usersService.getProfile(req.user.userId);
  }

  @Put('profile')
  updateProfile(@Request() req, @Body() updateProfileDto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.userId, updateProfileDto);
  }

  @Post('profile/avatar')
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(@Request() req, @UploadedFile() file: Express.Multer.File) {
    return this.usersService.updateAvatar(req.user.userId, file);
  }

  @Put('notifications')
  updateNotifications(@Request() req, @Body() updateNotificationsDto: UpdateNotificationsDto) {
    return this.usersService.updateNotifications(req.user.userId, updateNotificationsDto);
  }

  @Put('fcm-token')
  updateFcmToken(@Request() req, @Body() updateFcmTokenDto: UpdateFcmTokenDto) {
    return this.usersService.updateFcmToken(req.user.userId, updateFcmTokenDto);
  }
}
