import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryKind } from '../../domain/category-kind';
import { Category } from '../../domain/entities/category.entity';
import {
  CategoryRepositoryPort,
  CreateCategoryInput,
} from '../../domain/ports/category.repository.port';
import { CategoryOrmEntity } from './category.orm-entity';

@Injectable()
export class TypeOrmCategoryRepository implements CategoryRepositoryPort {
  constructor(
    @InjectRepository(CategoryOrmEntity)
    private readonly categories: Repository<CategoryOrmEntity>,
  ) {}

  async create(input: CreateCategoryInput): Promise<Category> {
    const row = this.categories.create({
      userId: input.userId,
      name: input.name,
      kind: input.kind,
    });
    const saved = await this.categories.save(row);
    return this.toDomain(saved);
  }

  async createMany(inputs: CreateCategoryInput[]): Promise<Category[]> {
    if (inputs.length === 0) {
      return [];
    }
    const rows = inputs.map((input) =>
      this.categories.create({
        userId: input.userId,
        name: input.name,
        kind: input.kind,
      }),
    );
    const saved = await this.categories.save(rows);
    return saved.map((row) => this.toDomain(row));
  }

  async findByUserId(userId: string): Promise<Category[]> {
    const rows = await this.categories.find({
      where: { userId },
      order: { name: 'ASC' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findByIdForUser(id: string, userId: string): Promise<Category | null> {
    const row = await this.categories.findOne({ where: { id, userId } });
    return row ? this.toDomain(row) : null;
  }

  async findNamesByUserId(userId: string): Promise<Set<string>> {
    const rows = await this.categories.find({
      where: { userId },
    });
    return new Set(rows.map((row) => row.name));
  }

  async existsByUserAndName(userId: string, name: string): Promise<boolean> {
    const count = await this.categories.count({ where: { userId, name } });
    return count > 0;
  }

  private toDomain(row: CategoryOrmEntity): Category {
    return new Category({
      id: row.id,
      userId: row.userId,
      name: row.name,
      kind: row.kind as CategoryKind,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
