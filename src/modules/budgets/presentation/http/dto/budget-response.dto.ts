import { ApiProperty } from '@nestjs/swagger';
import { BudgetPeriod } from '../../../domain/budget-period';
import type { BudgetStatus } from '../../../domain/budget-thresholds';

class BudgetRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Food' })
  name!: string;
}

class BudgetUsageDto {
  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' })
  periodStart!: string;

  @ApiProperty({ example: '2026-11-01T00:00:00.000Z', description: 'Exclusive' })
  periodEnd!: string;

  @ApiProperty({ example: '412.30', description: 'Completed expenses this period' })
  spent!: string;

  @ApiProperty({ example: '87.70', description: 'Negative when over budget' })
  remaining!: string;

  @ApiProperty({ example: 82.5 })
  percentUsed!: number;

  @ApiProperty({ enum: ['ok', 'warning', 'exceeded'], description: 'warning ≥ 80%, exceeded ≥ 100%' })
  status!: BudgetStatus;
}

export class BudgetResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: BudgetRefDto })
  category!: BudgetRefDto;

  @ApiProperty({ type: BudgetRefDto, description: 'Wallet the budget applies to' })
  account!: BudgetRefDto;

  @ApiProperty({ example: 'USD', description: "The wallet's currency" })
  currencyCode!: string;

  @ApiProperty({ example: '500.00' })
  amount!: string;

  @ApiProperty({ enum: BudgetPeriod })
  period!: BudgetPeriod;

  @ApiProperty({ type: BudgetUsageDto })
  usage!: BudgetUsageDto;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
