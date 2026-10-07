import { CategoryKind } from '../category-kind';
import { Category } from '../entities/category.entity';

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');

export type CreateCategoryInput = {
  userId: string;
  name: string;
  kind: CategoryKind;
};

export interface CategoryRepositoryPort {
  create(input: CreateCategoryInput): Promise<Category>;
  createMany(inputs: CreateCategoryInput[]): Promise<Category[]>;
  findByUserId(userId: string): Promise<Category[]>;
  findNamesByUserId(userId: string): Promise<Set<string>>;
  existsByUserAndName(userId: string, name: string): Promise<boolean>;
}
