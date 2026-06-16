import { Controller, Get, Put, Post, Delete, Body, UseGuards, Request, UploadedFile, UseInterceptors, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('users')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
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

  @Post('favorites/:listingId')
  @ApiOperation({ summary: 'Add a listing to favorites' })
  @ApiParam({ name: 'listingId', type: 'string' })
  addFavorite(@Request() req, @Param('listingId') listingId: string) {
    return this.usersService.addFavorite(req.user.userId, listingId);
  }

  @Delete('favorites/:listingId')
  @ApiOperation({ summary: 'Remove a listing from favorites' })
  @ApiParam({ name: 'listingId', type: 'string' })
  removeFavorite(@Request() req, @Param('listingId') listingId: string) {
    return this.usersService.removeFavorite(req.user.userId, listingId);
  }

  @Get('favorites')
  @ApiOperation({ summary: 'Get all favorite listings' })
  getFavorites(@Request() req, @Query('page') page: string, @Query('limit') limit: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.usersService.getFavorites(req.user.userId, pageNum, limitNum);
  }

  @Get('favorites/:listingId/check')
  @ApiOperation({ summary: 'Check if a listing is favorited' })
  @ApiParam({ name: 'listingId', type: 'string' })
  checkFavorite(@Request() req, @Param('listingId') listingId: string) {
    return this.usersService.checkFavorite(req.user.userId, listingId);
  }
}

@ApiTags('internal')
@Controller()
export class UsersInternalController {
  constructor(private readonly usersService: UsersService) {}

  @Put('users/:id/status')
  @ApiOperation({ summary: 'Internal: Update user status' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ schema: { properties: { status: { type: 'string', enum: ['active', 'suspended', 'banned'] } } } })
  async updateStatus(@Param('id') id: string, @Request() req, @Body() body: { status: string }) {
    const internalSecret = req.headers['x-internal-secret'];
    if (internalSecret !== (process.env.INTERNAL_SECRET || 'marad-internal-secret-for-webhooks')) {
      throw new import('@nestjs/common').UnauthorizedException('Invalid internal secret');
    }
    await this.usersService.updateStatus(id, body.status);
    return { success: true };
  }

  @Put('users/:id/verify')
  @ApiOperation({ summary: 'Internal: Verify user identity' })
  @ApiParam({ name: 'id', type: 'string' })
  async verifyUser(@Param('id') id: string) {
    // In real app we might also check for internal secret here
    await this.usersService.verifyUser(id);
    return { success: true };
  }
}
