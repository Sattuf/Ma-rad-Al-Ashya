import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Get category tree' })
  @ApiResponse({ status: 200, description: 'Return all categories as a tree.' })
  getTree() {
    return this.categoriesService.getTree();
  }
}
