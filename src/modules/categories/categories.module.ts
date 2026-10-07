import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@/modules/auth/auth.module';
import { CreateCategoryUseCase } from './application/create-category.use-case';
import { CreateDefaultCategoriesUseCase } from './application/create-default-categories.use-case';
import { ListCategoriesUseCase } from './application/list-categories.use-case';
import { UserActivatedListener } from './application/listeners/user-activated.listener';
import { CATEGORY_REPOSITORY } from './domain/ports/category.repository.port';
import { CategoryOrmEntity } from './infrastructure/persistence/category.orm-entity';
import { TypeOrmCategoryRepository } from './infrastructure/persistence/typeorm-category.repository';
import { CategoriesController } from './presentation/http/categories.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CategoryOrmEntity]), AuthModule],
  controllers: [CategoriesController],
  providers: [
    CreateCategoryUseCase,
    ListCategoriesUseCase,
    CreateDefaultCategoriesUseCase,
    UserActivatedListener,
    {
      provide: CATEGORY_REPOSITORY,
      useClass: TypeOrmCategoryRepository,
    },
  ],
  exports: [CATEGORY_REPOSITORY, CreateDefaultCategoriesUseCase],
})
export class CategoriesModule {}
