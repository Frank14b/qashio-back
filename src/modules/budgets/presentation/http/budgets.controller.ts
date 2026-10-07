import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import Decimal from 'decimal.js';
import { ActivityAction } from '@/modules/activity-logs/domain/activity-action.enum';
import { LogActivity } from '@/modules/activity-logs/presentation/decorators/log-activity.decorator';
import {
  AccessTokenUser,
  CurrentUser,
} from '@/modules/auth/presentation/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/modules/auth/presentation/guards/jwt-auth.guard';
import { ErrorResponseDto } from '@/shared/http/error-response.dto';
import { formatMoney } from '@/shared/money/money-input';
import { CreateBudgetsUseCase } from '../../application/create-budgets.use-case';
import { DeleteBudgetUseCase } from '../../application/delete-budget.use-case';
import { BudgetWithUsage, GetBudgetsUseCase } from '../../application/get-budgets.use-case';
import { UpdateBudgetUseCase } from '../../application/update-budget.use-case';
import { budgetStatus, usedPercent } from '../../domain/budget-thresholds';
import { CreateBudgetsRequestDto, UpdateBudgetRequestDto } from './dto/budget-request.dto';
import { BudgetResponseDto } from './dto/budget-response.dto';

@ApiTags('budgets')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@Controller('budgets')
export class BudgetsController {
  constructor(
    private readonly createBudgets: CreateBudgetsUseCase,
    private readonly getBudgets: GetBudgetsUseCase,
    private readonly updateBudget: UpdateBudgetUseCase,
    private readonly deleteBudget: DeleteBudgetUseCase,
  ) {}

  @Post()
  @LogActivity({ action: ActivityAction.BUDGET_CREATE, resourceType: 'budget' })
  @ApiOperation({
    summary: 'Create budgets on a wallet: one per category, same limit and period (all or none)',
  })
  @ApiCreatedResponse({ type: BudgetResponseDto, isArray: true })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Category or wallet not found' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'A category is already budgeted' })
  async create(
    @CurrentUser() user: AccessTokenUser,
    @Body() body: CreateBudgetsRequestDto,
  ): Promise<BudgetResponseDto[]> {
    const created = await this.createBudgets.execute({ userId: user.sub, ...body });
    const withUsage = await this.getBudgets.attachUsage(created);
    return withUsage.map((b) => this.toResponse(b));
  }

  @Get()
  @ApiOperation({ summary: 'List budgets with current-period spending' })
  @ApiOkResponse({ type: BudgetResponseDto, isArray: true })
  async list(@CurrentUser() user: AccessTokenUser): Promise<BudgetResponseDto[]> {
    const budgets = await this.getBudgets.list(user.sub);
    return budgets.map((b) => this.toResponse(b));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one budget with current-period spending' })
  @ApiOkResponse({ type: BudgetResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async getOne(
    @CurrentUser() user: AccessTokenUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BudgetResponseDto> {
    return this.toResponse(await this.getBudgets.getOne(user.sub, id));
  }

  @Patch(':id')
  @LogActivity({ action: ActivityAction.BUDGET_UPDATE, resourceType: 'budget', resourceIdFrom: 'id' })
  @ApiOperation({ summary: 'Change a budget limit or period' })
  @ApiOkResponse({ type: BudgetResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  async update(
    @CurrentUser() user: AccessTokenUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateBudgetRequestDto,
  ): Promise<BudgetResponseDto> {
    await this.updateBudget.execute({ userId: user.sub, budgetId: id, ...body });
    return this.toResponse(await this.getBudgets.getOne(user.sub, id));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @LogActivity({
    action: ActivityAction.BUDGET_DELETE,
    resourceType: 'budget',
    resourceIdFrom: 'id',
    emptyResponse: true,
  })
  @ApiOperation({ summary: 'Delete a budget' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  remove(
    @CurrentUser() user: AccessTokenUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ id: string }> {
    // Returned only for the activity log; the interceptor sends 204 with no body.
    return this.deleteBudget.execute(user.sub, id);
  }

  private toResponse({ budget, usage }: BudgetWithUsage): BudgetResponseDto {
    const places = budget.account.decimalPlaces;
    return {
      id: budget.id,
      category: budget.category,
      account: { id: budget.account.id, name: budget.account.name },
      currencyCode: budget.currencyCode,
      amount: formatMoney(budget.amount, places),
      period: budget.period,
      usage: {
        periodStart: usage.periodStart.toISOString(),
        periodEnd: usage.periodEnd.toISOString(),
        spent: formatMoney(usage.spent, places),
        remaining: new Decimal(budget.amount).minus(usage.spent).toFixed(places),
        percentUsed: usedPercent(usage.spent, budget.amount).toDecimalPlaces(1).toNumber(),
        status: budgetStatus(usage.spent, budget.amount),
      },
      createdAt: budget.createdAt.toISOString(),
      updatedAt: budget.updatedAt.toISOString(),
    };
  }
}
