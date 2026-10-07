import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { CategoryKind } from '../domain/category-kind';
import { Category } from '../domain/entities/category.entity';
import {
  CATEGORY_REPOSITORY,
  CategoryRepositoryPort,
} from '../domain/ports/category.repository.port';

export type CreateCategoryCommand = {
  userId: string;
  name: string;
  kind: CategoryKind;
};

@Injectable()
export class CreateCategoryUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepositoryPort,
  ) {}

  async execute(command: CreateCategoryCommand): Promise<Category> {
    const name = command.name.trim();
    if (!name) {
      throw new BadRequestException('Category name is required');
    }

    const exists = await this.categories.existsByUserAndName(command.userId, name);
    if (exists) {
      throw new ConflictException(`Category already exists: ${name}`);
    }

    return this.categories.create({
      userId: command.userId,
      name,
      kind: command.kind,
    });
  }
}
