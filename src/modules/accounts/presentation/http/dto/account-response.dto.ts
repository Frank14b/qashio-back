import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccountResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ example: 'Cash' })
  name!: string;

  @ApiProperty({ example: 'USD' })
  currencyCode!: string;

  @ApiProperty({
    example: '1500.00',
    description: 'Decimal string formatted to the currency’s decimal places',
  })
  openingBalance!: string;

  @ApiProperty({
    example: '1342.75',
    description:
      'openingBalance + completed income − completed expense, formatted to the currency’s decimal places',
  })
  balance!: string;

  @ApiProperty({ example: true })
  isDefault!: boolean;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Set when the wallet is soft-archived',
  })
  archivedAt!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
