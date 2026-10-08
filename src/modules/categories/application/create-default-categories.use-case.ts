import { Inject, Injectable, Logger } from '@nestjs/common';
import { Category } from '../domain/entities/category.entity';
import {
  CATEGORY_REPOSITORY,
  CategoryRepositoryPort,
} from '../domain/ports/category.repository.port';
import { DEFAULT_CATEGORY_SEEDS } from './default-categories';

export type CreateDefaultCategoriesCommand = {
  userId: string;
};

@Injectable()
export class CreateDefaultCategoriesUseCase {
  private readonly logger = new Logger(CreateDefaultCategoriesUseCase.name);

  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepositoryPort,
  ) {}

  /**
   * Idempotent: only inserts default names the user does not already have.
   */
  async execute(command: CreateDefaultCategoriesCommand): Promise<Category[]> {
    const existingNames = await this.categories.findNamesByUserId(command.userId);
    const missing = DEFAULT_CATEGORY_SEEDS.filter(
      (seed) => !existingNames.has(seed.name),
    );

    if (missing.length === 0) {
      this.logger.debug(
        `Default categories already present for user ${command.userId}; skipping`,
      );
      return [];
    }

    const created = await this.categories.createMany(
      missing.map((seed) => ({
        userId: command.userId,
        name: seed.name,
        kind: seed.kind,
      })),
    );

    this.logger.log(
      `Created ${created.length} default categories for user ${command.userId}`,
    );
    return created;
  }
}
