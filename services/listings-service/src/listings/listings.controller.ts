import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards, Request, UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingStatus } from './entities/listing.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all listings with optional filters' })
  findAll(@Query() query: any) {
    return this.listingsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a listing by id' })
  async findOne(@Param('id') id: string) {
    const listing = await this.listingsService.findOne(id);
    await this.listingsService.incrementView(id);
    return listing;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a listing' })
  create(@Request() req, @Body() createDto: CreateListingDto) {
    return this.listingsService.create(req.user.userId, createDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a listing' })
  update(@Param('id') id: string, @Request() req, @Body() updateDto: UpdateListingDto) {
    return this.listingsService.update(id, req.user.userId, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a listing' })
  remove(@Param('id') id: string, @Request() req) {
    return this.listingsService.delete(id, req.user.userId);
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Upload an image for a listing' })
  uploadImage(
    @Param('id') id: string,
    @Request() req,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg)' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.listingsService.addImage(id, req.user.userId, file);
  }

  @Delete(':id/images/:imageId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an image from a listing' })
  deleteImage(@Param('id') id: string, @Param('imageId') imageId: string, @Request() req) {
    return this.listingsService.deleteImage(id, imageId, req.user.userId);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({ schema: { properties: { status: { type: 'string', enum: Object.values(ListingStatus) } } } })
  @ApiOperation({ summary: 'Update listing status' })
  updateStatus(@Param('id') id: string, @Request() req, @Body('status') status: ListingStatus) {
    return this.listingsService.updateStatus(id, req.user.userId, status);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get listings by user ID' })
  findByUser(@Param('userId') userId: string) {
    return this.listingsService.findByUser(userId);
  }

  @Get('category/:categoryId')
  @ApiOperation({ summary: 'Get listings by category ID' })
  findByCategory(@Param('categoryId') categoryId: string) {
    return this.listingsService.findByCategory(categoryId);
  }
}
