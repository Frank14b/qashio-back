import { ApiProperty, PartialType, PickType } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsUUID } from 'class-validator';
import { IsDecimalString } from '@/shared/money/is-decimal-string.decorator';
import { RequireAtLeastOne } from '@/shared/validation/require-at-least-one.decorator';
import { BudgetPeriod } from '../../../domain/budget-period';

export class CreateBudgetsRequestDto {
  @ApiProperty({ format: 'uuid', description: 'Wallet the budgets apply to; sets the currency' })
  @IsUUID()
  accountId!: string;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Expense (or both) categories; one budget is created per category',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  categoryIds!: string[];

  @ApiProperty({ example: '500.00', type: String, description: 'Spending limit per period' })
  @IsDecimalString()
  amount!: string;

  @ApiProperty({ enum: BudgetPeriod, example: BudgetPeriod.MONTHLY })
  @IsEnum(BudgetPeriod)
  period!: BudgetPeriod;
}

/** Scope is fixed after creation; only the limit and period can change. */
@RequireAtLeastOne(['amount', 'period'])
export class UpdateBudgetRequestDto extends PartialType(
  PickType(CreateBudgetsRequestDto, ['amount', 'period'] as const),
) {}
