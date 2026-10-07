import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
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
import { Account } from '../../domain/entities/account.entity';
import { CreateAccountUseCase } from '../../application/create-account.use-case';
import { GetAccountUseCase } from '../../application/get-account.use-case';
import { ListAccountsUseCase } from '../../application/list-accounts.use-case';
import { UpdateAccountUseCase } from '../../application/update-account.use-case';
import { AccountResponseDto } from './dto/account-response.dto';
import { CreateAccountRequestDto } from './dto/create-account-request.dto';
import { UpdateAccountRequestDto } from './dto/update-account-request.dto';

@ApiTags('accounts')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly createAccount: CreateAccountUseCase,
    private readonly listAccounts: ListAccountsUseCase,
    private readonly getAccount: GetAccountUseCase,
    private readonly updateAccount: UpdateAccountUseCase,
  ) {}

  @Post()
  @LogActivity({
    action: ActivityAction.ACCOUNT_CREATE,
    resourceType: 'account',
    resourceIdFrom: 'id',
  })
  @ApiOperation({ summary: 'Create a wallet/account for the authenticated user' })
  @ApiCreatedResponse({ type: AccountResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async create(
    @CurrentUser() user: AccessTokenUser,
    @Body() body: CreateAccountRequestDto,
  ): Promise<AccountResponseDto> {
    const account = await this.createAccount.execute({
      userId: user.sub,
      name: body.name,
      currencyCode: body.currencyCode,
      isDefault: body.isDefault,
    });
    return this.toResponse(account);
  }

  @Get()
  @ApiOperation({ summary: 'List wallets for the authenticated user' })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    type: Boolean,
    description: 'Include soft-archived wallets (default false)',
  })
  @ApiOkResponse({ type: AccountResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async list(
    @CurrentUser() user: AccessTokenUser,
    @Query('includeArchived', new DefaultValuePipe(false), ParseBoolPipe)
    includeArchived: boolean,
  ): Promise<AccountResponseDto[]> {
    const accounts = await this.listAccounts.execute({
      userId: user.sub,
      includeArchived,
    });
    return accounts.map((a) => this.toResponse(a));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one wallet by id' })
  @ApiOkResponse({ type: AccountResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async getOne(
    @CurrentUser() user: AccessTokenUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AccountResponseDto> {
    const account = await this.getAccount.execute({
      userId: user.sub,
      accountId: id,
    });
    return this.toResponse(account);
  }

  @Patch(':id')
  @LogActivity({
    action: ActivityAction.ACCOUNT_UPDATE,
    resourceType: 'account',
    resourceIdFrom: 'id',
  })
  @ApiOperation({ summary: 'Update wallet name, default flag, or archive' })
  @ApiOkResponse({ type: AccountResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async update(
    @CurrentUser() user: AccessTokenUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAccountRequestDto,
  ): Promise<AccountResponseDto> {
    const account = await this.updateAccount.execute({
      userId: user.sub,
      accountId: id,
      name: body.name,
      isDefault: body.isDefault,
      archive: body.archive,
    });
    return this.toResponse(account);
  }

  private toResponse(account: Account): AccountResponseDto {
    return {
      id: account.id,
      name: account.name,
      currencyCode: account.currencyCode,
      isDefault: account.isDefault,
      archivedAt: account.archivedAt?.toISOString() ?? null,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }
}
