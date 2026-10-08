import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { IsDecimalString } from '@/shared/money/is-decimal-string.decorator';
import { Trim } from '@/shared/validation/trim.transform';

export class CreateAccountRequestDto {
  @ApiProperty({ example: 'Cash' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'USD', description: 'ISO 4217 currency code' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  currencyCode!: string;

  @ApiPropertyOptional({
    example: true,
    description: 'At most one default per user; first wallet becomes default if omitted',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    example: '1500.00',
    type: String,
    description:
      'Balance before the first transaction (decimal string or number, may be negative). Defaults to 0.',
  })
  @IsOptional()
  @IsDecimalString()
  openingBalance?: string;
}
