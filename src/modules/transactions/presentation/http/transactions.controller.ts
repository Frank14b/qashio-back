import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
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
import { formatMoney } from '@/shared/money/money-input';
import { CreateTransactionUseCase } from '../../application/create-transaction.use-case';
import { DeleteTransactionUseCase } from '../../application/delete-transaction.use-case';
import { GetTransactionUseCase } from '../../application/get-transaction.use-case';
import { ListTransactionsUseCase } from '../../application/list-transactions.use-case';
import { SummarizeTransactionsUseCase } from '../../application/summarize-transactions.use-case';
import { UpdateTransactionUseCase } from '../../application/update-transaction.use-case';
import { Transaction } from '../../domain/entities/transaction.entity';
import { CreateTransactionRequestDto } from './dto/create-transaction-request.dto';
import {
  ListTransactionsQueryDto,
  TransactionSummaryQueryDto,
} from './dto/list-transactions-query.dto';
import {
  TransactionListResponseDto,
  TransactionResponseDto,
  TransactionSummaryResponseDto,
} from './dto/transaction-response.dto';
import { UpdateTransactionRequestDto } from './dto/update-transaction-request.dto';

const toDate = (value?: string): Date | undefined => (value ? new Date(value) : undefined);

@ApiTags('transactions')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly createTransaction: CreateTransactionUseCase,
    private readonly listTransactions: ListTransactionsUseCase,
    private readonly getTransaction: GetTransactionUseCase,
    private readonly updateTransaction: UpdateTransactionUseCase,
    private readonly deleteTransaction: DeleteTransactionUseCase,
    private readonly summarizeTransactions: SummarizeTransactionsUseCase,
  ) {}

  @Post()
  @LogActivity({
    action: ActivityAction.TRANSACTION_CREATE,
    resourceType: 'transaction',
    resourceIdFrom: 'id',
  })
  @ApiOperation({ summary: 'Record an income or expense on a wallet' })
  @ApiCreatedResponse({ type: TransactionResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Account or category not found' })
  async create(
    @CurrentUser() user: AccessTokenUser,
    @Body() body: CreateTransactionRequestDto,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.createTransaction.execute({
      userId: user.sub,
      accountId: body.accountId,
      categoryId: body.categoryId,
      type: body.type,
      amount: body.amount,
      counterparty: body.counterparty,
      narration: body.narration,
      occurredAt: toDate(body.occurredAt),
    });
    return this.toResponse(transaction);
  }

  @Get()
  @ApiOperation({ summary: 'List transactions (filter, sort, paginate)' })
  @ApiOkResponse({ type: TransactionListResponseDto })
  async list(
    @CurrentUser() user: AccessTokenUser,
    @Query() query: ListTransactionsQueryDto,
  ): Promise<TransactionListResponseDto> {
    const page = await this.listTransactions.execute({
      userId: user.sub,
      accountId: query.accountId,
      categoryId: query.categoryId,
      type: query.type,
      status: query.status,
      from: toDate(query.from),
      to: toDate(query.to),
      search: query.search,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      page: query.page,
      limit: query.limit,
    });
    const pageNumber = query.page ?? 1;
    const limit = query.limit ?? 10;
    return {
      items: page.items.map((t) => this.toResponse(t)),
      meta: {
        page: pageNumber,
        limit,
        total: page.total,
        totalPages: Math.ceil(page.total / limit),
      },
    };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Completed income / expense / net totals per currency' })
  @ApiOkResponse({ type: TransactionSummaryResponseDto, isArray: true })
  summary(
    @CurrentUser() user: AccessTokenUser,
    @Query() query: TransactionSummaryQueryDto,
  ): Promise<TransactionSummaryResponseDto[]> {
    return this.summarizeTransactions.execute({
      userId: user.sub,
      accountId: query.accountId,
      from: toDate(query.from),
      to: toDate(query.to),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one transaction' })
  @ApiOkResponse({ type: TransactionResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async getOne(
    @CurrentUser() user: AccessTokenUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.getTransaction.execute({
      userId: user.sub,
      transactionId: id,
    });
    return this.toResponse(transaction);
  }

  @Put(':id')
  @LogActivity({
    action: ActivityAction.TRANSACTION_UPDATE,
    resourceType: 'transaction',
    resourceIdFrom: 'id',
  })
  @ApiOperation({ summary: 'Update a transaction (only the fields sent are changed)' })
  @ApiOkResponse({ type: TransactionResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async update(
    @CurrentUser() user: AccessTokenUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTransactionRequestDto,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.updateTransaction.execute({
      userId: user.sub,
      transactionId: id,
      accountId: body.accountId,
      categoryId: body.categoryId,
      type: body.type,
      amount: body.amount,
      counterparty: body.counterparty,
      narration: body.narration,
      occurredAt: toDate(body.occurredAt),
    });
    return this.toResponse(transaction);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @LogActivity({
    action: ActivityAction.TRANSACTION_DELETE,
    resourceType: 'transaction',
    resourceIdFrom: 'id',
    emptyResponse: true,
  })
  @ApiOperation({ summary: 'Delete a transaction' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async remove(
    @CurrentUser() user: AccessTokenUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ id: string }> {
    // Returned only so the activity log can read the id; the interceptor sends 204 with no body.
    const snapshot = await this.deleteTransaction.execute({
      userId: user.sub,
      transactionId: id,
    });
    return { id: snapshot.id };
  }

  private toResponse(transaction: Transaction): TransactionResponseDto {
    const places = transaction.account.decimalPlaces;
    return {
      id: transaction.id,
      reference: transaction.reference,
      type: transaction.type,
      direction: transaction.direction,
      amount: formatMoney(transaction.amount, places),
      signedAmount: formatMoney(transaction.signedAmount, places),
      currencyCode: transaction.account.currencyCode,
      status: transaction.status,
      counterparty: transaction.counterparty,
      narration: transaction.narration,
      occurredAt: transaction.occurredAt.toISOString(),
      account: {
        id: transaction.account.id,
        name: transaction.account.name,
        currencyCode: transaction.account.currencyCode,
      },
      category: {
        id: transaction.category.id,
        name: transaction.category.name,
        kind: transaction.category.kind,
      },
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
    };
  }
}
