import { ApiProperty } from '@nestjs/swagger';

export class CurrencyResponseDto {
  @ApiProperty({ example: 'USD', description: 'ISO 4217 currency code' })
  code!: string;

  @ApiProperty({ example: 'US Dollar' })
  name!: string;

  @ApiProperty({ example: '$' })
  symbol!: string;

  @ApiProperty({ example: 2 })
  decimalPlaces!: number;
}
