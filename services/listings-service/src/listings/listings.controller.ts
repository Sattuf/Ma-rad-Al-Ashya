import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe, Request, UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingStatus } from './entities/listing.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { assertInternalRequest } from '../common/security';

@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get listings (paginated, max 50 per page)' })
  findAll(@Query() query: Record<string, any>) {
    return this.listingsService.findAll(query);
  }

  // Declared before ':id' so these paths are not treated as ids.
  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the current user's listings (paginated)" })
  findMine(@Request() req, @Query() query: Record<string, any>) {
    return this.listingsService.findMine(req.user.userId, query);
  }

  // The web dashboard expects a plain array here (apps/web/src/lib/api/listings.ts).
  @Get('my-listings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the current user's listings (array, first page)" })
  async findMineArray(@Request() req, @Query() query: Record<string, any>) {
    return (await this.listingsService.findMine(req.user.userId, query)).data;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a listing by id' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const listing = await this.listingsService.findOne(id);
    await this.listingsService.incrementView(id);
    this.listingsService.sendViewEvent(listing.id, listing.categoryId, req.headers['authorization']);
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
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a listing' })
  update(@Param('id', ParseUUIDPipe) id: string, @Request() req, @Body() updateDto: UpdateListingDto) {
    return this.listingsService.update(id, req.user.userId, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a listing' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.listingsService.delete(id, req.user.userId);
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
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
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Request() req, @Body('status') status: ListingStatus) {
    return this.listingsService.updateStatus(id, req.user.userId, status);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Internal: Update listing status' })
  @ApiBody({ schema: { properties: { status: { type: 'string', enum: Object.values(ListingStatus) } } } })
  async updateStatusInternal(@Param('id', ParseUUIDPipe) id: string, @Request() req, @Body('status') status: ListingStatus) {
    assertInternalRequest(req.headers);
    // Update status internally, bypassing owner check
    return this.listingsService.updateStatusInternal(id, status);
  }

  @Post('batch')
  @ApiOperation({ summary: 'Internal: Get multiple listings by IDs' })
  @ApiBody({ schema: { properties: { ids: { type: 'array', items: { type: 'string' } } } } })
  async findBatch(@Request() req, @Body('ids') ids: string[]) {
    assertInternalRequest(req.headers);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!ids || !Array.isArray(ids) || ids.length > 50 || !ids.every((id) => typeof id === 'string' && uuid.test(id))) {
      throw new BadRequestException('Invalid or too many IDs (max 50)');
    }
    return this.listingsService.findBatch(ids);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get listings by user ID' })
  findByUser(@Param('userId', ParseUUIDPipe) userId: string, @Query() query: Record<string, any>) {
    return this.listingsService.findByUser(userId, query);
  }

  @Get('category/:categoryId')
  @ApiOperation({ summary: 'Get listings by category ID' })
  findByCategory(@Param('categoryId', ParseUUIDPipe) categoryId: string, @Query() query: Record<string, any>) {
    return this.listingsService.findByCategory(categoryId, query);
  }
}
