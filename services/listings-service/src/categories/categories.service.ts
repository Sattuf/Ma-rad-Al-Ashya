import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  async getTree(): Promise<Category[]> {
    const allCategories = await this.categoriesRepository.find();
    
    const buildTree = (parentId: string | null): Category[] => {
      return allCategories
        .filter(cat => cat.parentId === parentId)
        .map(cat => ({
          ...cat,
          children: buildTree(cat.id),
        }));
    };

    return buildTree(null);
  }

  async findOne(id: string): Promise<Category | null> {
    return this.categoriesRepository.findOne({ where: { id } });
  }
}
