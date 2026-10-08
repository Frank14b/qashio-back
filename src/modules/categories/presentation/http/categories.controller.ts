import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ActivityAction } from '@/modules/activity-logs/domain/activity-action.enum';
import { LogActivity } from '@/modules/activity-logs/presentation/decorators/log-activity.decorator';
import {
  AccessTokenUser,
  CurrentUser,
} from '@/modules/auth/presentation/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/modules/auth/presentation/guards/jwt-auth.guard';
import { ErrorResponseDto } from '@/shared/http/error-response.dto';
import { Category } from '../../domain/entities/category.entity';
import { CreateCategoryUseCase } from '../../application/create-category.use-case';
import { ListCategoriesUseCase } from '../../application/list-categories.use-case';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CreateCategoryRequestDto } from './dto/create-category-request.dto';

@ApiTags('categories')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly createCategory: CreateCategoryUseCase,
    private readonly listCategories: ListCategoriesUseCase,
  ) {}

  @Post()
  @LogActivity({
    action: ActivityAction.CATEGORY_CREATE,
    resourceType: 'category',
    resourceIdFrom: 'id',
  })
  @ApiOperation({ summary: 'Create a category for the authenticated user' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async create(
    @CurrentUser() user: AccessTokenUser,
    @Body() body: CreateCategoryRequestDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.createCategory.execute({
      userId: user.sub,
      name: body.name,
      kind: body.kind,
    });
    return this.toResponse(category);
  }

  @Get()
  @ApiOperation({ summary: 'List categories for the authenticated user' })
  @ApiOkResponse({ type: CategoryResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async list(@CurrentUser() user: AccessTokenUser): Promise<CategoryResponseDto[]> {
    const categories = await this.listCategories.execute({ userId: user.sub });
    return categories.map((c) => this.toResponse(c));
  }

  private toResponse(category: Category): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      kind: category.kind,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }
}
