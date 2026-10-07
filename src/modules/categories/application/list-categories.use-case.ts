import { Inject, Injectable } from '@nestjs/common';
import { Category } from '../domain/entities/category.entity';
import {
  CATEGORY_REPOSITORY,
  CategoryRepositoryPort,
} from '../domain/ports/category.repository.port';

export type ListCategoriesCommand = {
  userId: string;
};

@Injectable()
export class ListCategoriesUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepositoryPort,
  ) {}

  execute(command: ListCategoriesCommand): Promise<Category[]> {
    return this.categories.findByUserId(command.userId);
  }
}
