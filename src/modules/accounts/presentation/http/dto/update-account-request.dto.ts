import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsDecimalString } from '@/shared/money/is-decimal-string.decorator';
import { IsExclusiveWith } from '@/shared/validation/is-exclusive-with.decorator';
import { RequireAtLeastOne } from '@/shared/validation/require-at-least-one.decorator';
import { Trim } from '@/shared/validation/trim.transform';

@RequireAtLeastOne(['name', 'isDefault', 'archive', 'openingBalance'])
export class UpdateAccountRequestDto {
  @ApiPropertyOptional({ example: 'Revolut EUR' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Set as the user’s default wallet (clears previous default)',
  })
  @IsOptional()
  @IsBoolean()
  @IsExclusiveWith('archive')
  isDefault?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Soft-archive (true) or restore (false). Cannot be combined with isDefault: true',
  })
  @IsOptional()
  @IsBoolean()
  archive?: boolean;

  @ApiPropertyOptional({
    example: '1500.00',
    type: String,
    description: 'New opening balance (decimal string or number, may be negative)',
  })
  @IsOptional()
  @IsDecimalString()
  openingBalance?: string;
}
