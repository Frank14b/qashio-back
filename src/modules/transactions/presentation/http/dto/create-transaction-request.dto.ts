import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsDecimalString } from '@/shared/money/is-decimal-string.decorator';
import { TransactionType } from '../../../domain/transaction-type';

export class CreateTransactionRequestDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Wallet to record on. Defaults to the user’s default wallet.',
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({
    enum: TransactionType,
    example: TransactionType.EXPENSE,
    description: '`income` = money in (+), `expense` = money out (−)',
  })
  @IsEnum(TransactionType)
  type!: TransactionType;

  @ApiProperty({
    example: '42.50',
    type: String,
    description:
      'Positive decimal (string or number). Sign comes from `type`; decimals must fit the wallet currency.',
  })
  @IsDecimalString()
  amount!: string;

  @ApiPropertyOptional({ example: 'Carrefour', maxLength: 160, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  counterparty?: string | null;

  @ApiPropertyOptional({ example: 'Weekly groceries', maxLength: 1000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  narration?: string | null;

  @ApiPropertyOptional({
    example: '2026-10-07T09:30:00.000Z',
    description: 'When the transaction happened (ISO 8601). Defaults to now.',
  })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
