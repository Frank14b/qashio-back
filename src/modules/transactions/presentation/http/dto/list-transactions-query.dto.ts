import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsNotBefore } from '@/shared/validation/is-not-before.decorator';
import {
  SortOrder,
  TRANSACTION_SORT_FIELDS,
  TransactionSortField,
} from '../../../domain/ports/transaction.repository.port';
import { TransactionStatus } from '../../../domain/transaction-status';
import { TransactionType } from '../../../domain/transaction-type';

export class TransactionSummaryQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z', description: 'Inclusive' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-31T23:59:59.999Z',
    description: 'Inclusive; must not be before `from`',
  })
  @IsOptional()
  @IsDateString()
  @IsNotBefore('from')
  to?: string;
}

export class ListTransactionsQueryDto extends TransactionSummaryQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: TRANSACTION_SORT_FIELDS, default: 'occurredAt' })
  @IsOptional()
  @IsIn(TRANSACTION_SORT_FIELDS)
  sortBy?: TransactionSortField;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsIn(['ASC', 'DESC'])
  sortOrder?: SortOrder;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional({ description: 'Matches reference, counterparty or narration' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
