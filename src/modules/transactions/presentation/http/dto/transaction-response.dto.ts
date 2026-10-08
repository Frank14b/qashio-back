import { ApiProperty } from '@nestjs/swagger';
import { CategoryKind } from '@/modules/categories/domain/category-kind';
import { TransactionStatus } from '../../../domain/transaction-status';
import { TransactionType } from '../../../domain/transaction-type';

export class TransactionAccountDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Cash' })
  name!: string;

  @ApiProperty({ example: 'USD' })
  currencyCode!: string;
}

export class TransactionCategoryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Food' })
  name!: string;

  @ApiProperty({ enum: CategoryKind })
  kind!: CategoryKind;
}

export class TransactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'TXN-261007-7K3Q9D', description: 'Unique human-readable reference' })
  reference!: string;

  @ApiProperty({ enum: TransactionType })
  type!: TransactionType;

  @ApiProperty({ enum: ['in', 'out'], description: '`in` for income, `out` for expense' })
  direction!: 'in' | 'out';

  @ApiProperty({ example: '42.50', description: 'Positive amount, formatted to the currency scale' })
  amount!: string;

  @ApiProperty({ example: '-42.50', description: 'Amount with its balance effect applied' })
  signedAmount!: string;

  @ApiProperty({ example: 'USD' })
  currencyCode!: string;

  @ApiProperty({ enum: TransactionStatus, description: 'Read-only for now (always `completed`)' })
  status!: TransactionStatus;

  @ApiProperty({ example: 'Carrefour', nullable: true, type: String })
  counterparty!: string | null;

  @ApiProperty({ example: 'Weekly groceries', nullable: true, type: String })
  narration!: string | null;

  @ApiProperty()
  occurredAt!: string;

  @ApiProperty({ type: TransactionAccountDto })
  account!: TransactionAccountDto;

  @ApiProperty({ type: TransactionCategoryDto })
  category!: TransactionCategoryDto;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

export class TransactionListResponseDto {
  @ApiProperty({ type: TransactionResponseDto, isArray: true })
  items!: TransactionResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class TransactionSummaryResponseDto {
  @ApiProperty({ example: 'USD' })
  currencyCode!: string;

  @ApiProperty({ example: '3200.00' })
  income!: string;

  @ApiProperty({ example: '1845.30' })
  expense!: string;

  @ApiProperty({ example: '1354.70', description: 'income − expense' })
  net!: string;

  @ApiProperty({ example: 37 })
  count!: number;
}
